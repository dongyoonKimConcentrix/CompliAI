import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer";

type MailConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  from: string;
};

let cachedTransport: Transporter | null = null;
let cachedConfigKey: string | null = null;

export function getMailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) return null;

  return {
    host,
    port: Number(process.env.SMTP_PORT || "587"),
    user,
    pass,
    secure: process.env.SMTP_SECURE === "true",
    from: process.env.EMAIL_FROM || user,
  };
}

export function isSmtpConfigured(): boolean {
  return getMailConfig() !== null;
}

function getTransportConfigKey(config: MailConfig): string {
  return `${config.host}:${config.port}:${config.user}:${config.secure}`;
}

function getSharedTransport(): { transport: Transporter; config: MailConfig } | null {
  const config = getMailConfig();
  if (!config) return null;

  const key = getTransportConfigKey(config);
  if (!cachedTransport || cachedConfigKey !== key) {
    cachedTransport?.close();
    cachedTransport = nodemailer.createTransport({
      pool: true,
      maxConnections: 1,
      maxMessages: 100,
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    cachedConfigKey = key;
  }

  return { transport: cachedTransport, config };
}

export async function sendVerificationEmail(
  to: string,
  name: string,
  verifyUrl: string
): Promise<void> {
  const shared = getSharedTransport();

  if (!shared) {
    throw new Error("SMTP 설정이 없습니다.");
  }

  const { transport, config } = shared;

  await transport.sendMail({
    from: `"CompliAI" <${config.from}>`,
    to,
    subject: "[CompliAI] 이메일 인증을 완료해 주세요",
    text: [
      `${name}님, CompliAI 회원가입을 환영합니다.`,
      "",
      "아래 링크를 클릭해 이메일 인증을 완료해 주세요.",
      verifyUrl,
      "",
      "링크는 24시간 동안 유효합니다.",
      "본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #6366f1;">CompliAI 이메일 인증</h2>
        <p>${name}님, 회원가입을 환영합니다.</p>
        <p>아래 버튼을 클릭해 이메일 인증을 완료해 주세요.</p>
        <p style="margin: 32px 0;">
          <a href="${verifyUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
            이메일 인증하기
          </a>
        </p>
        <p style="color:#666;font-size:14px;">버튼이 동작하지 않으면 아래 링크를 복사해 브라우저에 붙여넣으세요.</p>
        <p style="color:#666;font-size:14px;word-break:break-all;">${verifyUrl}</p>
        <p style="color:#999;font-size:12px;">링크는 24시간 동안 유효합니다.</p>
      </div>
    `,
  });
}

export type MonthlyWinnerMailPayload = {
  to: string;
  name: string;
  periodLabel: string;
  winners: Array<{
    name: string;
    score: number;
    praiseCount: number;
    likeCount: number;
  }>;
  rankingsUrl: string;
  isTest?: boolean;
};

function formatWinnersText(
  winners: MonthlyWinnerMailPayload["winners"],
  isTest?: boolean
): string {
  if (winners.length === 0) {
    return isTest
      ? "해당 월 칭찬왕이 없습니다. (실제 자동/수동 발송 시에는 메일이 발송되지 않습니다.)"
      : "해당 월 칭찬왕이 없습니다.";
  }
  return winners
    .map(
      (w, i) =>
        `${winners.length > 1 ? `${i + 1}. ` : ""}${w.name} (${w.score}점 · 칭찬 ${w.praiseCount}건 · 좋아요 ${w.likeCount})`
    )
    .join("\n");
}

function formatWinnersHtml(
  winners: MonthlyWinnerMailPayload["winners"],
  isTest?: boolean
): string {
  if (winners.length === 0) {
    const msg = isTest
      ? "해당 월 칭찬왕이 없습니다. (실제 자동/수동 발송 시에는 메일이 발송되지 않습니다.)"
      : "해당 월 칭찬왕이 없습니다.";
    return `<p style="color:#666;">${msg}</p>`;
  }
  const items = winners
    .map(
      (w) =>
        `<li><strong>${w.name}</strong> — ${w.score}점 (칭찬 ${w.praiseCount}건, 좋아요 ${w.likeCount})</li>`
    )
    .join("");
  return `<ul style="padding-left: 20px;">${items}</ul>`;
}

export async function sendMonthlyWinnerAnnouncement(
  payload: MonthlyWinnerMailPayload
): Promise<void> {
  const shared = getSharedTransport();

  if (!shared) {
    throw new Error("SMTP 설정이 없습니다.");
  }

  const { transport, config } = shared;
  const { to, name, periodLabel, winners, rankingsUrl, isTest } = payload;
  const winnerText = formatWinnersText(winners, isTest);
  const winnerHtml = formatWinnersHtml(winners, isTest);
  const testPrefix = isTest ? "[테스트] " : "";
  const subject =
    winners.length > 0
      ? `${testPrefix}[CompliAI] ${periodLabel} 칭찬왕 발표`
      : `${testPrefix}[CompliAI] ${periodLabel} 칭찬왕 메일 테스트`;

  const introLine =
    winners.length > 0
      ? `${periodLabel} CompliAI 칭찬왕을 발표합니다!`
      : `${periodLabel} 칭찬왕 메일 발송 테스트입니다.`;

  await transport.sendMail({
    from: `"CompliAI" <${config.from}>`,
    to,
    subject,
    text: [
      `${name}님, 안녕하세요.`,
      "",
      introLine,
      "",
      winnerText,
      "",
      `전체 랭킹 보기: ${rankingsUrl}`,
      "",
      isTest ? "※ 관리자 테스트 발송 메일입니다." : "CompliAI와 함께해 주셔서 감사합니다.",
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #171717;">${testPrefix}${periodLabel} 칭찬왕 🏆</h2>
        <p>${name}님, 안녕하세요.</p>
        <p>${introLine}</p>
        ${winnerHtml}
        <p style="margin: 32px 0;">
          <a href="${rankingsUrl}" style="background:#171717;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
            랭킹 보러 가기
          </a>
        </p>
        ${isTest ? '<p style="color:#999;font-size:12px;">※ 관리자 테스트 발송 메일입니다.</p>' : '<p style="color:#666;font-size:14px;">CompliAI와 함께해 주셔서 감사합니다.</p>'}
      </div>
    `,
  });
}
