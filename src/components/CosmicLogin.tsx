"use client";

import { ArrowRight, Eye, EyeOff, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

interface LoginUser { id: string; name: string; email: string }

export function CosmicLogin({ user, pending, sessionError, reason, onAuthenticated, onSignedOut, onRetry }: {
  user: LoginUser | null; pending: boolean; sessionError: boolean; reason: "save" | "history" | null;
  onAuthenticated: () => Promise<void>; onSignedOut: () => Promise<void>; onRetry: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const submitting = useRef(false);

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

  return <section className="cosmic-account">
    <p className="cosmic-eyebrow">为这段旅程，留下一束星光</p>
    <h2>{user ? `你好，${user.name}` : "遇见星空中的自己"}</h2>
    <span className="cosmic-sample-label"><ShieldCheck size={12} />演示账号登录</span>
    {pending ? <p className="cosmic-dialog-intro cosmic-auth-status" role="status">正在确认登录状态…</p> : sessionError ? <div className="cosmic-auth-status">
      <p className="cosmic-journal-error" role="alert">暂时无法确认登录状态。请重新连接后再查看个人手记。</p>
      <button type="button" className="cosmic-secondary" disabled={busy} onClick={retry}>{busy ? "正在重试…" : "重新连接"}</button>
    </div> : user ? <div className="cosmic-login cosmic-account-profile">
      <div className="cosmic-account-identity"><span className="cosmic-account-avatar"><UserRound size={28} strokeWidth={1} /></span><div><strong>{user.name}</strong><span>{user.email}</span></div></div>
      <p>本次旅程留下的手记，将保存在你的账号中。再次登录后，仍可继续回望。</p>
      <button type="button" className="cosmic-secondary" onClick={signOut} disabled={busy}><LogOut size={16} />{busy ? "正在退出…" : "退出登录"}</button>
    </div> : <>
      <p className="cosmic-dialog-intro">{reason === "save" ? "登录后可保存本次解读，刚才的问题与牌面会为你保留。" : reason === "history" ? "登录后，回看属于你的问题、牌面与解读。" : "登录后，让每一次探索都有迹可循。"}</p>
      <form className="cosmic-login cosmic-account-form" onSubmit={signIn}>
        <label htmlFor="cosmic-email">邮箱</label>
        <input id="cosmic-email" type="email" autoComplete="username" maxLength={254} required value={email} disabled={busy} placeholder="输入演示账号邮箱" onChange={(event) => { setEmail(event.target.value); setError(""); }} />
        <label htmlFor="cosmic-password">密码</label>
        <div className="cosmic-password-field"><input id="cosmic-password" type={showPassword ? "text" : "password"} autoComplete="current-password" maxLength={128} required value={password} disabled={busy} placeholder="输入演示账号密码" onChange={(event) => { setPassword(event.target.value); setError(""); }} />
          <button type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} aria-pressed={showPassword} disabled={busy} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        <button type="submit" className="cosmic-primary" disabled={busy || !email.trim() || !password}>{busy ? "正在登录…" : "登录"}<ArrowRight size={17} /></button>
      </form>
      <p className="cosmic-small-note cosmic-account-note">使用提供的演示账号；本轮暂未开放注册与找回密码。</p>
    </>}
    {error && <p className="cosmic-journal-error" role="alert">{error}</p>}
  </section>;
}
