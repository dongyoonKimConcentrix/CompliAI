"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { config, type IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowLeft,
  faArrowUpRightFromSquare,
  faAward,
  faBars,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faCircleInfo,
  faEnvelope,
  faEnvelopeCircleCheck,
  faFlag as faFlagSolid,
  faFlask,
  faGear,
  faHeart as faHeartSolid,
  faKey,
  faLinkSlash,
  faListCheck,
  faMagnifyingGlass,
  faMedal,
  faMicrochip,
  faMoon,
  faPaperPlane,
  faPen,
  faReply,
  faRightFromBracket,
  faShieldHalved,
  faSliders,
  faSun,
  faTableColumns,
  faTrash,
  faTrophy,
  faUser,
  faUsers,
  faUserXmark,
} from "@fortawesome/free-solid-svg-icons";
import {
  faComment,
  faFlag as faFlagRegular,
  faHeart as faHeartRegular,
} from "@fortawesome/free-regular-svg-icons";
import "@fortawesome/fontawesome-svg-core/styles.css";

config.autoAddCss = false;

const ICONS: Record<string, IconDefinition> = {
  "fa-solid fa-arrow-left": faArrowLeft,
  "fa-solid fa-arrow-up-right-from-square": faArrowUpRightFromSquare,
  "fa-solid fa-award": faAward,
  "fa-solid fa-bars": faBars,
  "fa-solid fa-check": faCheck,
  "fa-solid fa-chevron-down": faChevronDown,
  "fa-solid fa-chevron-left": faChevronLeft,
  "fa-solid fa-chevron-right": faChevronRight,
  "fa-solid fa-circle-check": faCircleCheck,
  "fa-solid fa-circle-info": faCircleInfo,
  "fa-solid fa-envelope": faEnvelope,
  "fa-solid fa-envelope-circle-check": faEnvelopeCircleCheck,
  "fa-solid fa-flag": faFlagSolid,
  "fa-solid fa-flask": faFlask,
  "fa-solid fa-gear": faGear,
  "fa-solid fa-heart": faHeartSolid,
  "fa-solid fa-key": faKey,
  "fa-solid fa-link-slash": faLinkSlash,
  "fa-solid fa-list-check": faListCheck,
  "fa-solid fa-magnifying-glass": faMagnifyingGlass,
  "fa-solid fa-medal": faMedal,
  "fa-solid fa-microchip": faMicrochip,
  "fa-solid fa-moon": faMoon,
  "fa-solid fa-paper-plane": faPaperPlane,
  "fa-solid fa-pen": faPen,
  "fa-solid fa-reply": faReply,
  "fa-solid fa-right-from-bracket": faRightFromBracket,
  "fa-solid fa-shield-halved": faShieldHalved,
  "fa-solid fa-sliders": faSliders,
  "fa-solid fa-sun": faSun,
  "fa-solid fa-table-columns": faTableColumns,
  "fa-solid fa-trash": faTrash,
  "fa-solid fa-trophy": faTrophy,
  "fa-solid fa-user": faUser,
  "fa-solid fa-users": faUsers,
  "fa-solid fa-user-xmark": faUserXmark,
  "fa-regular fa-comment": faComment,
  "fa-regular fa-flag": faFlagRegular,
  "fa-regular fa-heart": faHeartRegular,
};

type IconProps = {
  name: string;
  className?: string;
};

function parseIconName(raw: string): { key: string; extraClass: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  const style = parts.find((p) => p === "fa-solid" || p === "fa-regular") ?? "fa-solid";
  const icon = parts.find(
    (p) => p.startsWith("fa-") && p !== "fa-solid" && p !== "fa-regular"
  );
  const extraClass = parts.filter((p) => p !== style && p !== icon).join(" ");
  return { key: icon ? `${style} ${icon}` : "", extraClass };
}

export function Icon({ name, className = "" }: IconProps) {
  const { key, extraClass } = parseIconName(name);
  const icon = ICONS[key];
  if (!icon) {
    return <span className={className} aria-hidden="true" />;
  }

  return (
    <FontAwesomeIcon
      icon={icon}
      className={`${extraClass} ${className}`.trim()}
      aria-hidden
    />
  );
}
