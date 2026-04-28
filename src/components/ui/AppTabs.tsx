import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export type AppTabDef<T extends string> = {
  id: T;
  label: string;
};

type AppTabsProps<T extends string> = {
  value: T;
  onChange: (id: T) => void;
  tabs: readonly AppTabDef<T>[];
  ariaLabel: string;
  /** بادئة فريدة لكل مجموعة تبويبات في الصفحة (لـ id / aria-controls) */
  groupId: string;
  className?: string;
};

/**
 * شريط تبويبات موحّد (نفس أسلوب درس التطبيق) مع ربط بسيط بـ tabpanel.
 */
export function AppTabs<T extends string>({
  value,
  onChange,
  tabs,
  ariaLabel,
  groupId,
  className,
}: AppTabsProps<T>) {
  return (
    <div className={cn("lesson-tabs", "app-tabs", className)} role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => {
        const tabId = `${groupId}-tab-${t.id}`;
        const panelId = `${groupId}-panel-${t.id}`;
        const selected = value === t.id;
        return (
          <button
            key={t.id}
            id={tabId}
            type="button"
            className={selected ? "lesson-tab lesson-tab--active" : "lesson-tab"}
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function AppTabPanel<T extends string>({
  tabId,
  groupId,
  hidden,
  children,
  className,
}: {
  tabId: T;
  groupId: string;
  hidden: boolean;
  children: ReactNode;
  className?: string;
}) {
  const panelId = `${groupId}-panel-${tabId}`;
  const labelledBy = `${groupId}-tab-${tabId}`;
  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledBy}
      hidden={hidden}
      className={className}
    >
      {children}
    </div>
  );
}
