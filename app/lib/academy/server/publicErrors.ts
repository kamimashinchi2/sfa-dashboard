/** Bilingual copy for stable error codes. Never include upstream bodies or secrets. */

const FA: Record<string, string> = {
  BRIDGE_CONFIG_MISSING: "پیکربندی سرویس ناقص است. با پشتیبانی تماس بگیرید.",
  BRIDGE_URL_REJECTED: "آدرس سرویس نامعتبر است. با پشتیبانی تماس بگیرید.",
  BRIDGE_UNREACHABLE: "سرویس آکادمی در دسترس نیست. کمی بعد دوباره تلاش کنید.",
  BRIDGE_TIMEOUT: "مهلت اتصال به سرویس آکادمی تمام شد.",
  HTTPS_REQUIRED: "ورود فقط روی HTTPS عمومی مجاز است.",
  ORIGIN_REJECTED: "درخواست از مبدأ نامعتبر رد شد.",
  RATE_LIMIT: "تعداد درخواست‌ها زیاد است. کمی صبر کنید.",
  RATE_LIMITED: "تعداد درخواست‌ها زیاد است. کمی صبر کنید.",
  UNAUTHORIZED: "برای ادامه وارد شوید.",
  STAGE_LOCKED: "این درس هنوز قفل است. تأیید آزمون درس بعدی را باز نمی‌کند.",
  GONE: "این مسیر بازنشسته شده است. از حساب کاربری استفاده کنید.",
  VALIDATION_FAILED: "درخواست پذیرفته نشد.",
  PAYLOAD_TOO_LARGE: "حجم درخواست بیش از حد مجاز است.",
  UNSUPPORTED_MEDIA: "نوع محتوا پشتیبانی نمی‌شود.",
  UPLOAD_FAILED: "بارگذاری انجام نشد. دوباره تلاش کنید.",
  NO_SESSION_TOKEN: "نشست ساخته نشد. دوباره تلاش کنید.",
  UPSTREAM_INVALID: "پاسخ سرویس قابل استفاده نبود.",
  LOGIN_FAILED: "ایمیل یا رمز عبور نادرست است.",
  PASSWORD_12_TO_256_REQUIRED: "رمز عبور باید حداقل ۱۲ نویسه باشد.",
  DATA_NOTICE_REQUIRED: "پذیرش اطلاعیه داده لازم است.",
  INVITE_EXPIRED_OR_INVALID: "دعوت‌نامه منقضی یا نامعتبر است.",
  SIGNUP_UNAVAILABLE: "ثبت‌نام با این ایمیل ممکن نیست.",
  EMAIL_INVALID: "ایمیل نامعتبر است.",
  NAME_REQUIRED: "نام نمایشی لازم است.",
  RESET_EXPIRED_OR_INVALID: "پیوند بازیابی منقضی یا استفاده‌شده است.",
  ADMIN_REQUIRED: "این بخش فقط برای مدیر است.",
};

const EN: Record<string, string> = {
  BRIDGE_CONFIG_MISSING: "Academy service is misconfigured. Contact support.",
  BRIDGE_URL_REJECTED: "Academy service URL was rejected. Contact support.",
  BRIDGE_UNREACHABLE: "Academy service is unreachable. Try again shortly.",
  BRIDGE_TIMEOUT: "Academy service timed out.",
  HTTPS_REQUIRED: "Login is only allowed on the public HTTPS origin.",
  ORIGIN_REJECTED: "Request origin was rejected.",
  RATE_LIMIT: "Too many requests. Please wait.",
  RATE_LIMITED: "Too many requests. Please wait.",
  UNAUTHORIZED: "Please sign in to continue.",
  STAGE_LOCKED:
    "This lesson is still locked. Quiz approval never unlocks the next lesson.",
  GONE: "This endpoint is retired. Use the account API.",
  VALIDATION_FAILED: "The request was rejected.",
  PAYLOAD_TOO_LARGE: "The request is too large.",
  UNSUPPORTED_MEDIA: "Unsupported content type.",
  UPLOAD_FAILED: "Upload failed. Try again.",
  NO_SESSION_TOKEN: "A session was not created. Try again.",
  UPSTREAM_INVALID: "The academy service returned an unusable response.",
  LOGIN_FAILED: "Email or password is incorrect.",
  PASSWORD_12_TO_256_REQUIRED: "Password must be at least 12 characters.",
  DATA_NOTICE_REQUIRED: "The data notice must be accepted.",
  INVITE_EXPIRED_OR_INVALID: "This invite is expired or invalid.",
  SIGNUP_UNAVAILABLE: "Signup is not available for this email.",
  EMAIL_INVALID: "Email is invalid.",
  NAME_REQUIRED: "Display name is required.",
  RESET_EXPIRED_OR_INVALID: "This recovery link is expired or already used.",
  ADMIN_REQUIRED: "This section is for an admin session.",
};

export function bilingual(code: string): { fa: string; en: string } {
  return {
    fa: FA[code] ?? FA.VALIDATION_FAILED!,
    en: EN[code] ?? EN.VALIDATION_FAILED!,
  };
}

export function safeErrorCode(message: unknown): string | undefined {
  if (typeof message !== "string") return undefined;
  if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(message)) return undefined;
  return message;
}
