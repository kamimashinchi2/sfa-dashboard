"use client";

type Locale = "fa" | "en";

function openSupportChat() {
  const api = (window as Window & { Tawk_API?: { maximize?: () => void } }).Tawk_API;
  if (typeof api?.maximize === "function") {
    api.maximize();
    return;
  }
  window.dispatchEvent(new Event("pointerdown"));
  const note = document.querySelector("[data-testid='support-chat-pending']");
  if (note instanceof HTMLElement) note.hidden = false;
}

export default function SupportPath({ locale }: { locale: Locale }) {
  const fa = locale === "fa";
  return (
    <section className="space-y-2 border border-line bg-ink/40 p-4 text-sm text-fog" data-testid="support-path">
      <h2 className="font-display text-lg text-paper">{fa ? "پشتیبانی بدون ایمیل" : "Support without email"}</h2>
      <p>
        {fa
          ? "ایمیل بازیابی ارسال نمی‌شود. اگر رمز را فراموش کردید، نام و ایمیلی که با آن ثبت‌نام کردید را در گفتگوی پشتیبانی بنویسید. مالک آکادمی هویت را بررسی می‌کند و یک پیوند یک‌بارمصرف می‌دهد که تا ۳۰ دقیقه معتبر است و همه نشست‌ها را می‌بندد."
          : "No recovery email is sent. If you forget the password, tell the support chat the name and email you signed up with. The academy owner checks who you are and gives you a one-time link. It expires in 30 minutes and signs you out everywhere."}
      </p>
      <button
        type="button"
        className="min-h-11 border border-gold/50 px-3 text-xs text-gold-soft"
        data-testid="open-support-chat"
        onClick={openSupportChat}
      >
        {fa ? "باز کردن گفتگوی پشتیبانی" : "Open the support chat"}
      </button>
      <p hidden data-testid="support-chat-pending">
        {fa
          ? "گفتگو پایین صفحه باز می‌شود. اگر ندیدید یک بار صفحه را تازه کنید."
          : "The chat opens at the bottom of the page. Refresh once if you do not see it."}
      </p>
    </section>
  );
}
