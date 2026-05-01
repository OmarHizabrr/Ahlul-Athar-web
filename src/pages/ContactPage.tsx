import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IoLogoWhatsapp, IoMailOutline, IoCallOutline, IoOpenOutline } from "react-icons/io5";
import { AuthPageShell } from "../components/AuthPageShell";
import { PageLoadHint } from "../components/ButtonBusyLabel";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { contactChannelHref, listContactChannels } from "../services/contactInfoService";
import type { ContactChannel } from "../types";

const P = "web_pages.contact" as const;

function KindIcon({ kind }: { kind: ContactChannel["kind"] }) {
  switch (kind) {
    case "whatsapp":
      return <IoLogoWhatsapp aria-hidden size={22} />;
    case "email":
      return <IoMailOutline aria-hidden size={22} />;
    case "link":
      return <IoOpenOutline aria-hidden size={22} />;
    default:
      return <IoCallOutline aria-hidden size={22} />;
  }
}

export function ContactPage() {
  const { t } = useI18n();
  const { user, ready } = useAuth();
  const isAdmin = ready && user?.role === "admin";
  const [rows, setRows] = useState<ContactChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(false);
      try {
        setRows(await listContactChannels());
      } catch {
        setError(true);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AuthPageShell>
      <section className="card contact-page-card">
        <div className="auth-title-block">
          <h1 className="auth-title">{t(`${P}.title`, "تواصل معنا")}</h1>
        </div>
        <div className="auth-divider" aria-hidden>
          <span className="auth-divider-icon">◆</span>
        </div>
        <p className="muted">{t(`${P}.subtitle`, "يسعدنا مساعدتك. اختر وسيلة التواصل المناسبة.")}</p>

        {isAdmin ? (
          <div className="contact-admin-banner">
            <p className="contact-admin-banner__text">
              {t(
                `${P}.admin_banner`,
                "أنت مسجّل كمسؤول. إضافة وتعديل أرقام التواصل تتم من لوحة الإدارة (/admin/contact) وليس من هذه الصفحة العامة.",
              )}
            </p>
            <Link
              to="/admin/contact"
              className="primary-btn contact-admin-banner__btn"
            >
              {t(`${P}.admin_manage`, "فتح صفحة إدارة التواصل")}
            </Link>
          </div>
        ) : null}

        {loading ? (
          <PageLoadHint text={t(`${P}.loading`, "جاري التحميل...")} />
        ) : error ? (
          <p className="muted" role="alert">
            {t(`${P}.load_error`, "تعذر تحميل بيانات التواصل. حاول لاحقاً.")}
          </p>
        ) : rows.length === 0 ? (
          <p className="muted">
            {isAdmin
              ? t(
                  `${P}.empty_admin`,
                  "لا توجد قنوات تظهر للزوار بعد. استخدم «فتح صفحة إدارة التواصل» أعلاه لإضافتها.",
                )
              : t(`${P}.empty`, "لم تُضف أرقام تواصل بعد. راجع المسؤول.")}
          </p>
        ) : (
          <ul className="contact-channel-list">
            {rows.map((c) => {
              const href = contactChannelHref(c);
              const external = c.kind === "link" || c.kind === "whatsapp";
              return (
                <li key={c.id}>
                  <a
                    className="contact-channel-item"
                    href={href}
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    <span className="contact-channel-item__icon" aria-hidden>
                      <KindIcon kind={c.kind} />
                    </span>
                    <span className="contact-channel-item__text">
                      <span className="contact-channel-item__label">{c.label}</span>
                      <span className="contact-channel-item__value">{c.value}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}

        <div className="contact-page-actions">
          <Link to="/login" className="link-btn">
            {t(`${P}.back_login`, "العودة لتسجيل الدخول")}
          </Link>
          <Link to="/role-selector" className="link-btn">
            {t(`${P}.back_role`, "اختيار نوع الحساب")}
          </Link>
        </div>
      </section>
    </AuthPageShell>
  );
}
