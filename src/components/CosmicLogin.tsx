"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowRight, Eye, EyeOff, History, Loader2, Lock, LogOut, Mail, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import "./cosmic-login.css";

interface LoginUser { id: string; name: string; email: string }

function CornerPin({ className }: { className: string }) {
  return <svg className={`cosmic-auth-corner ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M0.5 20V10A9.5 9.5 0 0 1 10 0.5H20" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.72" />
    <path d="M3.2 14.5A11.3 11.3 0 0 1 14.5 3.2" stroke="currentColor" strokeWidth="0.65" strokeLinecap="round" opacity="0.42" />
    <path d="M6.8 3.6L7.5 6.1L10 6.8L7.5 7.5L6.8 10L6.1 7.5L3.6 6.8L6.1 6.1Z" fill="currentColor" opacity="0.9" />
  </svg>;
}

function AstrolabeCrest() {
  const id = useId();
  return <svg className="cosmic-auth-crest" viewBox="0 0 180 54" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-gold`} x1="18" y1="6" x2="162" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#a98042" stopOpacity="0.18" />
        <stop offset="26%" stopColor="#e8c88c" stopOpacity="0.92" />
        <stop offset="50%" stopColor="#fff4d8" />
        <stop offset="74%" stopColor="#e8c88c" stopOpacity="0.92" />
        <stop offset="100%" stopColor="#a98042" stopOpacity="0.18" />
      </linearGradient>
      <radialGradient id={`${id}-glow`} cx="50%" cy="48%" r="50%">
        <stop offset="0%" stopColor="#ffe7b2" stopOpacity="0.42" />
        <stop offset="100%" stopColor="#d9b77c" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="90" cy="26" r="22" fill={`url(#${id}-glow)`} />
    <path d="M26 48A64 64 0 0 1 154 48" stroke={`url(#${id}-gold)`} strokeWidth="0.95" opacity="0.76" />
    <path d="M38 48A52 52 0 0 1 142 48" stroke={`url(#${id}-gold)`} strokeWidth="0.75" strokeDasharray="1.8 3.4" opacity="0.62" />
    <path d="M50 48A40 40 0 0 1 130 48" stroke={`url(#${id}-gold)`} strokeWidth="0.6" opacity="0.38" />
    <path d="M10 42H40M140 42H170" stroke={`url(#${id}-gold)`} strokeWidth="0.8" opacity="0.58" />
    <circle cx="44" cy="42" r="1.4" fill="#f3d69e" opacity="0.82" />
    <circle cx="136" cy="42" r="1.4" fill="#f3d69e" opacity="0.82" />
    <path d="M58 19L59 21.5L61.5 22.5L59 23.5L58 26L57 23.5L54.5 22.5L57 21.5Z" fill="#f5deb0" opacity="0.82" />
    <path d="M122 19L123 21.5L125.5 22.5L123 23.5L122 26L121 23.5L118.5 22.5L121 21.5Z" fill="#f5deb0" opacity="0.82" />
    <circle cx="90" cy="26" r="14.5" stroke={`url(#${id}-gold)`} strokeWidth="0.95" opacity="0.88" />
    <circle cx="90" cy="26" r="10.8" stroke={`url(#${id}-gold)`} strokeWidth="0.55" strokeDasharray="1.4 2.3" opacity="0.58" />
    <path d="M90 7L92.3 23.7L109 26L92.3 28.3L90 45L87.7 28.3L71 26L87.7 23.7Z" fill={`url(#${id}-gold)`} />
    <path d="M90 15.5L91.6 24.4L100.5 26L91.6 27.6L90 36.5L88.4 27.6L79.5 26L88.4 24.4Z" fill="#fff8e6" opacity="0.9" />
    <path d="M90 19.5L94.8 21.2L96.5 26L94.8 30.8L90 32.5L85.2 30.8L83.5 26L85.2 21.2Z" stroke="#b68a44" strokeWidth="0.5" opacity="0.55" />
    <path d="M29.6 38.2A3.6 3.6 0 1 1 24.2 34.4A2.9 2.9 0 1 0 29.6 38.2Z" fill="#e9c88b" opacity="0.72" />
    <path d="M150.4 38.2A3.6 3.6 0 1 0 155.8 34.4A2.9 2.9 0 1 1 150.4 38.2Z" fill="#e9c88b" opacity="0.72" />
  </svg>;
}

function AmethystDivider() {
  const id = useId();
  return <svg className="cosmic-auth-divider" viewBox="0 0 260 14" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-line`} x1="0" y1="7" x2="260" y2="7" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#d9b77c" stopOpacity="0" />
        <stop offset="35%" stopColor="#d9b77c" stopOpacity="0.55" />
        <stop offset="50%" stopColor="#f8e3ba" stopOpacity="0.95" />
        <stop offset="65%" stopColor="#d9b77c" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#d9b77c" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-gem`} x1="126" y1="2" x2="134" y2="12" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#d8b8f0" />
        <stop offset="52%" stopColor="#8962b0" />
        <stop offset="100%" stopColor="#462b69" />
      </linearGradient>
    </defs>
    <line x1="6" y1="7" x2="117" y2="7" stroke={`url(#${id}-line)`} strokeWidth="0.9" />
    <line x1="143" y1="7" x2="254" y2="7" stroke={`url(#${id}-line)`} strokeWidth="0.9" />
    <circle cx="111" cy="7" r="1.4" fill="#e5c589" opacity="0.8" />
    <circle cx="149" cy="7" r="1.4" fill="#e5c589" opacity="0.8" />
    <path d="M130 1.4L135.6 7L130 12.6L124.4 7Z" fill={`url(#${id}-gem)`} stroke="#f3d8a3" strokeWidth="0.9" />
    <path d="M130 3.3L132.4 7L130 10.7L127.6 7Z" fill="#f8e8ff" opacity="0.34" />
  </svg>;
}

function ProfileMedallion({ name }: { name: string }) {
  const id = useId();
  const initial = Array.from(name.trim())[0] || "";
  return <div className="cosmic-auth-medallion" aria-hidden="true">
    <svg className="cosmic-auth-medallion-ring" viewBox="0 0 82 82" fill="none" focusable="false">
      <defs>
        <linearGradient id={`${id}-ring`} x1="8" y1="8" x2="74" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f5dfb3" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#c79e59" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f5dfb3" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <circle cx="41" cy="41" r="38" stroke={`url(#${id}-ring)`} strokeWidth="0.9" />
      <path d="M41 1L42.5 4.2L41 7.4L39.5 4.2Z" fill="#f7e2b7" />
      <path d="M41 74.6L42.5 77.8L41 81L39.5 77.8Z" fill="#f7e2b7" />
      <path d="M1 41L4.2 39.5L7.4 41L4.2 42.5Z" fill="#e6c486" opacity="0.82" />
      <path d="M74.6 41L77.8 39.5L81 41L77.8 42.5Z" fill="#e6c486" opacity="0.82" />
      <circle cx="15" cy="15" r="1.2" fill="#e5c589" opacity="0.7" />
      <circle cx="67" cy="15" r="1.2" fill="#e5c589" opacity="0.7" />
      <circle cx="15" cy="67" r="1.2" fill="#e5c589" opacity="0.7" />
      <circle cx="67" cy="67" r="1.2" fill="#e5c589" opacity="0.7" />
    </svg>
    <svg className="cosmic-auth-medallion-ring-inner" viewBox="0 0 66 66" fill="none" focusable="false">
      <circle cx="33" cy="33" r="31.5" stroke="#d9b77c" strokeWidth="0.75" strokeDasharray="2 3.5" opacity="0.52" />
    </svg>
    <span className="cosmic-auth-medallion-core">{initial || <UserRound size={24} strokeWidth={1.2} />}</span>
  </div>;
}

function BottomFinial() {
  return <svg className="cosmic-auth-finial" viewBox="0 0 68 12" fill="none" aria-hidden="true" focusable="false">
    <line x1="2" y1="6" x2="25" y2="6" stroke="#d9b77c" strokeWidth="0.75" opacity="0.42" />
    <line x1="43" y1="6" x2="66" y2="6" stroke="#d9b77c" strokeWidth="0.75" opacity="0.42" />
    <circle cx="21" cy="6" r="1.1" fill="#e2c287" opacity="0.65" />
    <circle cx="47" cy="6" r="1.1" fill="#e2c287" opacity="0.65" />
    <path d="M34 1L35.4 4.6L39 6L35.4 7.4L34 11L32.6 7.4L29 6L32.6 4.6Z" fill="#efd097" opacity="0.88" />
  </svg>;
}

export function CosmicLogin({ user, pending, sessionError, reason, onAuthenticated, onSignedOut, onRetry, onOpenHistory }: {
  user: LoginUser | null; pending: boolean; sessionError: boolean; reason: "save" | "history" | null;
  onAuthenticated: () => Promise<void>; onSignedOut: () => Promise<void>; onRetry: () => Promise<void>;
  onOpenHistory?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const submitting = useRef(false);
  const reducedMotion = useReducedMotion();
  const mode = pending ? "pending" : sessionError ? "session-error" : user ? "profile" : "form";

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password, rememberMe: true });
      if (!mounted.current) return;
      if (result.error) {
        setError(result.error.status === 429 ? "尝试次数较多，请稍后再登录。" : result.error.status === 401 || result.error.status === 403 ? "邮箱或密码不正确，请重新输入。" : "登录暂时未成功，请稍后重试。");
        return;
      }
      setPassword(""); setShowPassword(false);
      await onAuthenticated();
    } catch {
      if (mounted.current) setError("暂时无法连接登录服务，请稍后重试。");
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function signOut() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const result = await authClient.signOut();
      if (!mounted.current) return;
      if (result.error) { setError("退出暂时未成功，请重试。"); return; }
      setPassword(""); setEmail(""); setShowPassword(false);
      await onSignedOut();
    } catch {
      if (mounted.current) setError("暂时无法连接登录服务，请重试退出。");
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function retry() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try { await onRetry(); }
    catch { if (mounted.current) setError("仍无法确认登录状态，请稍后重试。"); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }

  const transition = { duration: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] as const };

  return <section className="cosmic-account cosmic-auth-shell">
    <CornerPin className="cosmic-auth-corner--tl" />
    <CornerPin className="cosmic-auth-corner--tr" />
    <CornerPin className="cosmic-auth-corner--bl" />
    <CornerPin className="cosmic-auth-corner--br" />

    <header className="cosmic-auth-header">
      {user ? <ProfileMedallion name={user.name} /> : <AstrolabeCrest />}
      <p className="cosmic-auth-eyebrow">为这段旅程，留下一束星光</p>
      <h2 className="cosmic-auth-title">{user ? `你好，${user.name}` : "遇见星空中的自己"}</h2>
      <AmethystDivider />
    </header>

    <div className="cosmic-auth-body">
      <AnimatePresence mode="wait" initial={false}>
        {mode === "pending" && <motion.div key="pending" className="cosmic-auth-state" role="status"
          initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={transition}>
          <div className="cosmic-auth-state-ring" aria-hidden="true">
            <svg className="is-orbiting" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="24" stroke="#d9b77c" strokeWidth="1" strokeDasharray="3 4" opacity="0.55" />
              <circle cx="28" cy="4" r="2.2" fill="#f7e2b7" />
            </svg>
            <Loader2 size={20} strokeWidth={1.5} className="cosmic-auth-spinner" />
          </div>
          <p className="cosmic-auth-state-text">正在确认登录状态…</p>
        </motion.div>}

        {mode === "session-error" && <motion.div key="session-error" className="cosmic-auth-state"
          initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={transition}>
          <div className="cosmic-auth-alert" role="alert">
            <AlertCircle size={16} strokeWidth={1.6} aria-hidden="true" />
            <span>暂时无法确认登录状态。请重新连接后再查看个人手记。</span>
          </div>
          <button type="button" className="cosmic-auth-secondary cosmic-auth-retry-btn" disabled={busy} onClick={retry}>
            <RefreshCw size={15} strokeWidth={1.6} className={busy ? "cosmic-auth-spinner" : undefined} aria-hidden="true" />
            <span>{busy ? "正在重试…" : "重新连接"}</span>
          </button>
        </motion.div>}

        {mode === "profile" && user && <motion.div key="profile"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={transition}>
          <div className="cosmic-auth-profile-card">
            <div className="cosmic-auth-profile-meta">
              <div className="cosmic-auth-profile-name-row">
                <strong className="cosmic-auth-profile-name">{user.name}</strong>
                <span className="cosmic-auth-badge"><ShieldCheck size={12} strokeWidth={1.6} aria-hidden="true" />演示账号登录</span>
              </div>
              <span className="cosmic-auth-profile-email"><Mail size={13} strokeWidth={1.5} aria-hidden="true" /><span>{user.email}</span></span>
            </div>
            <p className="cosmic-auth-profile-copy">本次旅程留下的手记，将保存在你的账号中。再次登录后，仍可继续回望。</p>
          </div>
          <div className="cosmic-auth-profile-actions">
            {onOpenHistory && <button type="button" className="cosmic-auth-submit" disabled={busy} onClick={onOpenHistory}>
              <History size={15} strokeWidth={1.6} aria-hidden="true" />
              <span>查看个人手记</span>
            </button>}
            <button type="button" className="cosmic-auth-secondary is-danger" onClick={signOut} disabled={busy} style={onOpenHistory ? undefined : { gridColumn: "1 / -1" }}>
              {busy ? <Loader2 size={15} strokeWidth={1.6} className="cosmic-auth-spinner" aria-hidden="true" /> : <LogOut size={15} strokeWidth={1.6} aria-hidden="true" />}
              <span>{busy ? "正在退出…" : "退出登录"}</span>
            </button>
          </div>
        </motion.div>}

        {mode === "form" && <motion.div key="form"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={transition}>
          <p className="cosmic-auth-intro">{reason === "save" ? "登录后可保存本次解读，刚才的问题与牌面会为你保留。" : reason === "history" ? "登录后，回看属于你的问题、牌面与解读。" : "登录后，让每一次探索都有迹可循。"}</p>
          <form className="cosmic-auth-form" onSubmit={signIn}>
            <div className="cosmic-auth-field">
              <label className="cosmic-auth-label" htmlFor="cosmic-email">邮箱</label>
              <div className={`cosmic-auth-input-wrap ${busy ? "is-disabled" : ""}`}>
                <span className="cosmic-auth-input-icon" aria-hidden="true"><Mail size={16} strokeWidth={1.45} /></span>
                <input id="cosmic-email" className="cosmic-auth-input" type="email" autoComplete="username" maxLength={254} required value={email} disabled={busy} placeholder="输入演示账号邮箱" onChange={(event) => { setEmail(event.target.value); setError(""); }} />
              </div>
            </div>
            <div className="cosmic-auth-field">
              <label className="cosmic-auth-label" htmlFor="cosmic-password">密码</label>
              <div className={`cosmic-auth-input-wrap ${busy ? "is-disabled" : ""}`}>
                <span className="cosmic-auth-input-icon" aria-hidden="true"><Lock size={16} strokeWidth={1.45} /></span>
                <input id="cosmic-password" className="cosmic-auth-input has-toggle" type={showPassword ? "text" : "password"} autoComplete="current-password" maxLength={128} required value={password} disabled={busy} placeholder="输入演示账号密码" onChange={(event) => { setPassword(event.target.value); setError(""); }} />
                <button type="button" className="cosmic-auth-eye" aria-label={showPassword ? "隐藏密码" : "显示密码"} title={showPassword ? "隐藏密码" : "显示密码"} aria-pressed={showPassword} disabled={busy} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff size={16} strokeWidth={1.5} aria-hidden="true" /> : <Eye size={16} strokeWidth={1.5} aria-hidden="true" />}
                </button>
              </div>
            </div>
            <button type="submit" className="cosmic-auth-submit" disabled={busy || !email.trim() || !password}>
              {busy ? <><Loader2 size={16} strokeWidth={1.7} className="cosmic-auth-spinner" aria-hidden="true" /><span>正在登录…</span></> : <><span>登录</span><ArrowRight size={16} strokeWidth={1.6} className="cosmic-auth-submit-arrow" aria-hidden="true" /></>}
            </button>
          </form>
        </motion.div>}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {error && <motion.div key="error" className="cosmic-auth-alert" role="alert"
          initial={reducedMotion ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
          <AlertCircle size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{error}</span>
        </motion.div>}
      </AnimatePresence>

      {!user && <footer className="cosmic-auth-footer">
        <span className="cosmic-auth-badge"><ShieldCheck size={12} strokeWidth={1.6} aria-hidden="true" />演示账号登录</span>
        <p className="cosmic-auth-note">使用提供的演示账号；本轮暂未开放注册与找回密码。</p>
      </footer>}
    </div>

    <BottomFinial />
  </section>;
}
