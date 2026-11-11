/** Sanitized bilingual diagnostics — never surface secrets or upstream bodies. */
export function loginDiagMessage(
  locale: string,
  status: number,
  body: { error?: string; en?: string; fa?: string },
): string {
  if (body.fa && locale === "fa") return body.fa;
  if (body.en && locale !== "fa") return body.en;
  const code = body.error ?? `HTTP_${status}`;
  const fa: Record<string, string> = {
    BRIDGE_CONFIG_MISSING:
      "پیکربندی پل ورود ناقص است. با پشتیبانی تماس بگیرید.",
    BRIDGE_URL_REJECTED:
      "آدرس پل ورود نامعتبر است. با پشتیبانی تماس بگیرید.",
    BRIDGE_UNREACHABLE:
      "سرویس ورود در دسترس نیست. کمی بعد دوباره تلاش کنید.",
    BRIDGE_TIMEOUT: "مهلت اتصال به سرویس ورود تمام شد.",
    HTTPS_REQUIRED: "برای ورود امن به HTTPS نیاز است.",
    ORIGIN_REJECTED: "درخواست از مبدأ نامعتبر رد شد.",
    RATE_LIMIT: "تعداد درخواست‌ها زیاد است. کمی صبر کنید.",
  };
  const en: Record<string, string> = {
    BRIDGE_CONFIG_MISSING:
      "Login bridge is misconfigured. Contact support.",
    BRIDGE_URL_REJECTED:
      "Login bridge URL was rejected. Contact support.",
    BRIDGE_UNREACHABLE:
      "Login service is unreachable. Try again shortly.",
    BRIDGE_TIMEOUT: "Login service timed out.",
    HTTPS_REQUIRED: "HTTPS is required for secure login.",
    ORIGIN_REJECTED: "Request origin was rejected.",
    RATE_LIMIT: "Too many requests. Please wait.",
  };
  if (locale === "fa") return fa[code] ?? code;
  return en[code] ?? code;
}
