import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  IoBookOutline,
  IoMedalOutline,
  IoPersonOutline,
  IoSchoolOutline,
  IoShieldCheckmarkOutline,
  IoTimeOutline,
} from "react-icons/io5";
import { FaBookOpen, FaMosque } from "react-icons/fa6";
import { GiPalmTree } from "react-icons/gi";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import landingHeroImage from "../assets/landing-hero.png";

const L = "web_shell.landing" as const;

function LandingLeaf({ mirror }: { mirror?: boolean }) {
  return (
    <svg
      className={`landing-leaf${mirror ? " landing-leaf--mirror" : ""}`}
      width="28"
      height="36"
      viewBox="0 0 28 36"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M14 2c-4 8-12 12-12 22a12 12 0 0012 12V2zm0 0c4 8 12 12 12 22a12 12 0 01-12 12V2z"
        opacity="0.35"
      />
      <path
        fill="currentColor"
        d="M14 6c-2.5 6-8 9-9 16 2-4 6-6 9-7V6zm0 0c2.5 6 8 9 9 16-2-4-6-6-9-7V6z"
        opacity="0.55"
      />
    </svg>
  );
}

function LandingStarRule() {
  return (
    <div className="landing-star-rule" aria-hidden>
      <span className="landing-star-rule-line" />
      <span className="landing-star-rule-icon">✦</span>
      <span className="landing-star-rule-line" />
    </div>
  );
}

export function SplashPage() {
  const navigate = useNavigate();
  const { ready, user } = useAuth();
  const { lang, setLang, t } = useI18n();

  useEffect(() => {
    if (ready && user) {
      navigate(`/${user.role}`, { replace: true });
    }
  }, [ready, user, navigate]);

  if (!ready) {
    return (
      <main className="center-page center-page--landing center-page--landing-loading">
        <div className="landing-shell landing-shell--narrow">
          <p className="landing-badge">{t("web_shell.app_badge", "أهل الأثر")}</p>
          <div className="splash-page-spinner" aria-hidden>
            <span className="btn-spinner" />
          </div>
          <p className="landing-muted">{t("web_shell.auth_initializing", "جاري التهيئة...")}</p>
        </div>
      </main>
    );
  }

  if (user) {
    return null;
  }

  const Tk = (key: string, fb: string) => t(`${L}.${key}`, fb);

  return (
    <main className="center-page center-page--landing">
      <div className="landing-shell">
        <header className="landing-topbar">
          <Link to="/" className="landing-brand" aria-label={Tk("brand_aria", "أهل الأثر")}>
            <img src="/logo.png" alt="" className="landing-brand-logo" width={48} height={48} decoding="async" />
            <div className="landing-brand-text">
              <p className="landing-brand-title">{t("web_shell.app_badge", "أهل الأثر")}</p>
              <p className="landing-brand-tagline">{Tk("header_tagline", "منصة تعليم العلوم الشرعية")}</p>
            </div>
          </Link>

          <div className="landing-lang" role="group" aria-label={t("web_shell.lang_picker_title", "اختيار اللغة")}>
            <button
              type="button"
              className={`landing-lang-btn${lang === "ar" ? " is-active" : ""}`}
              onClick={() => setLang("ar")}
            >
              {t("web_shell.language_ar", "العربية")}
            </button>
            <button
              type="button"
              className={`landing-lang-btn landing-lang-btn--ghost${lang === "en" ? " is-active" : ""}`}
              onClick={() => setLang("en")}
            >
              <span className="landing-lang-globe" aria-hidden>
                🌐
              </span>
              {t("web_shell.language_en", "الإنجليزية")}
            </button>
            <button
              type="button"
              className={`landing-lang-btn landing-lang-btn--mini${lang === "chichewa" ? " is-active" : ""}`}
              onClick={() => setLang("chichewa")}
              title={t("web_shell.language_chichewa", "تشيشيوا")}
            >
              {Tk("lang_chichewa_short", "تشيشيوا")}
            </button>
          </div>
        </header>

        <section className="landing-hero" aria-labelledby="landing-hero-title">
          <div className="landing-hero-copy">
            <h1 id="landing-hero-title" className="landing-hero-title">
              {Tk("hero_title", "منصة أهل الأثر لتعليم العلوم الشرعية")}
            </h1>
            <p className="landing-hero-subtitle">
              {Tk(
                "hero_subtitle",
                "تعلم العربية، العقيدة، السيرة، والقرآن، والتوحيد بمنهج أهل السنة والجماعة",
              )}
            </p>
          </div>

          <div className="landing-hero-visual-wrap">
            <div className="landing-hero-arch">
              <div className="landing-hero-arch-inner">
                <img
                  src={landingHeroImage}
                  alt={Tk("hero_img_alt", "معالم إسلامية")}
                  className="landing-hero-photo"
                  width={360}
                  height={440}
                  loading="eager"
                  decoding="async"
                />
              </div>
              <div className="landing-hero-quran" aria-hidden>
                <span className="landing-hero-quran-book" />
                <span className="landing-hero-quran-stand" />
              </div>
            </div>
          </div>
        </section>

        <LandingStarRule />

        <section className="landing-section" aria-labelledby="landing-learn-title">
          <h2 id="landing-learn-title" className="landing-section-title">
            <LandingLeaf />
            <span>{Tk("section_learn_title", "ماذا ستتعلم؟")}</span>
            <LandingLeaf mirror />
          </h2>

          <div className="landing-cards-scroll">
            <article className="landing-card">
              <div className="landing-card-icon landing-card-icon--letter" aria-hidden>
                ض
              </div>
              <h3 className="landing-card-title">{Tk("card_ar_title", "العربية")}</h3>
              <p className="landing-card-desc">{Tk("card_ar_desc", "تعلم اللغة العربية من الصفر حتى الاحتراف.")}</p>
            </article>
            <article className="landing-card">
              <div className="landing-card-icon" aria-hidden>
                <FaMosque />
              </div>
              <h3 className="landing-card-title">{Tk("card_aq_title", "العقيدة")}</h3>
              <p className="landing-card-desc">{Tk("card_aq_desc", "تعلم عقيدة أهل السنة والجماعة.")}</p>
            </article>
            <article className="landing-card">
              <div className="landing-card-icon" aria-hidden>
                <GiPalmTree />
              </div>
              <h3 className="landing-card-title">{Tk("card_sir_title", "السيرة")}</h3>
              <p className="landing-card-desc">{Tk("card_sir_desc", "تعلم سيرة النبي ﷺ وحياة الصحابة.")}</p>
            </article>
            <article className="landing-card">
              <div className="landing-card-icon" aria-hidden>
                <FaBookOpen />
              </div>
              <h3 className="landing-card-title">{Tk("card_qur_title", "القرآن")}</h3>
              <p className="landing-card-desc">{Tk("card_qur_desc", "التلاوة والتجويد والتفسير.")}</p>
            </article>
            <article className="landing-card">
              <div className="landing-card-icon landing-card-icon--allah" aria-hidden>
                الله
              </div>
              <h3 className="landing-card-title">{Tk("card_taw_title", "التوحيد")}</h3>
              <p className="landing-card-desc">{Tk("card_taw_desc", "تعلم منهج التوحيد والإخلاص لله.")}</p>
            </article>
          </div>
        </section>

        <div className="landing-ctas">
          <button type="button" className="landing-cta landing-cta--primary" onClick={() => navigate("/role-selector")}>
            <IoSchoolOutline className="landing-cta-icon" aria-hidden />
            <span className="landing-cta-text">
              <span className="landing-cta-title">{Tk("cta_start", "ابدأ التعلم الآن")}</span>
              <span className="landing-cta-sub">{Tk("cta_start_sub", "انضم إلى آلاف الطلاب وابدأ رحلتك في طلب العلم.")}</span>
            </span>
          </button>
          <button type="button" className="landing-cta landing-cta--outline" onClick={() => navigate("/role-selector")}>
            <IoPersonOutline className="landing-cta-icon" aria-hidden />
            <span className="landing-cta-text">
              <span className="landing-cta-title">{Tk("cta_login", "تسجيل الدخول")}</span>
              <span className="landing-cta-sub">{Tk("cta_login_sub", "لديك حساب بالفعل؟ سجّل دخولك.")}</span>
            </span>
          </button>
        </div>

        <section className="landing-supervisor" aria-label={Tk("supervisor_heading", "الإشراف")}>
          <div className="landing-supervisor-seal" aria-hidden>
            <img src="/logo.png" alt="" width={56} height={56} decoding="async" />
          </div>
          <div className="landing-supervisor-body">
            <h3 className="landing-supervisor-heading">{Tk("supervisor_heading", "بإشراف الشيخ أبو سفيان خطيب داود")}</h3>
            <p className="landing-supervisor-text">{Tk("supervisor_text", "طالب علم ومعلّم للعلوم الشرعية.")}</p>
          </div>
          <div className="landing-supervisor-badge">
            <IoShieldCheckmarkOutline className="landing-supervisor-shield-icon" aria-hidden />
            <p>{Tk("supervisor_shield", "منهج سلفي أصيل قائم على الكتاب والسنة")}</p>
          </div>
        </section>

        <section className="landing-features">
          <div className="landing-feature">
            <IoBookOutline className="landing-feature-icon" aria-hidden />
            <h4>{Tk("feat_lessons_title", "دروس منظمة")}</h4>
            <p>{Tk("feat_lessons_desc", "مناهج مرتبة من الأساسيات إلى المتقدم.")}</p>
          </div>
          <div className="landing-feature">
            <IoTimeOutline className="landing-feature-icon" aria-hidden />
            <h4>{Tk("feat_anytime_title", "تعلّم في أي وقت")}</h4>
            <p>{Tk("feat_anytime_desc", "تعلّم من مكانك في الوقت الذي يناسبك.")}</p>
          </div>
          <div className="landing-feature">
            <IoMedalOutline className="landing-feature-icon" aria-hidden />
            <h4>{Tk("feat_certs_title", "شهادات معتمدة")}</h4>
            <p>{Tk("feat_certs_desc", "احصل على شهادة إتمام للدورات.")}</p>
          </div>
          <div className="landing-feature">
            <IoShieldCheckmarkOutline className="landing-feature-icon" aria-hidden />
            <h4>{Tk("feat_safe_title", "بيئة آمنة وموثوقة")}</h4>
            <p>{Tk("feat_safe_desc", "منصة تعليمية آمنة خالية من المخالفات.")}</p>
          </div>
        </section>

        <footer className="landing-footer">
          <h2 className="landing-footer-title">
            <LandingLeaf />
            <span>{Tk("footer_heading", "ابدأ رحلتك في طلب العلم اليوم")}</span>
            <LandingLeaf mirror />
          </h2>
          <p className="landing-footer-quote">{Tk("footer_quote", "العلم قبل القول والعمل")}</p>
        </footer>
      </div>
    </main>
  );
}
