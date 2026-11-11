export type Locale = "fa" | "en";

export type NextStep = {
  heading: string;
  body: string;
  href: string | null;
  cta: string | null;
};

const STATUS: Record<string, { fa: string; en: string }> = {
  LESSON_OPEN: { fa: "درس این هفته باز است", en: "This week's lesson is open" },
  QUIZ_SUBMITTED: { fa: "آزمون ثبت شد؛ در انتظار Echo", en: "Quiz submitted; waiting for Echo" },
  QUIZ_ASSESSED: { fa: "آزمون بررسی شد", en: "Quiz reviewed" },
  ASSIGNMENT_ISSUED: { fa: "تکلیف شخصی صادر شد", en: "Personal assignment is ready" },
  REMEDIAL_ISSUED: { fa: "هفته جبرانی همین مرحله", en: "Remedial week, same stage" },
  PRACTICAL_SUBMITTED: { fa: "تمرین ارسال شد؛ در انتظار Echo", en: "Practical submitted; waiting for Echo" },
  PRACTICAL_ASSESSED: { fa: "تمرین بررسی شد", en: "Practical reviewed" },
  NEXT_UNLOCKED: { fa: "درس بعدی باز شد", en: "Next lesson unlocked" },
  DOSSIER_READY: { fa: "پرونده مرحله ۸ آماده است", en: "Stage 8 dossier is ready" },
  AWAITING_SENIOR_MENTOR: { fa: "در انتظار جلسه منتور ارشد", en: "Waiting for the senior-mentor session" },
};

const NOTICE: Record<string, { fa: string; en: string }> = {
  QUIZ_RESULT_READY: { fa: "نتیجه آزمون آماده است", en: "Quiz result is ready" },
  ASSIGNMENT_READY: { fa: "تکلیف شخصی آماده است", en: "Personal assignment is ready" },
  PRACTICAL_GRADED: { fa: "تمرین عملی نمره گرفت", en: "Practical was graded" },
  LESSON_UNLOCKED: { fa: "درس بعدی باز شد", en: "Next lesson unlocked" },
  DECISION_RETRACTED: { fa: "یک نمره در ۲۴ ساعت اصلاح شد", en: "A grade was corrected within 24 hours" },
  DECISION_PENDING_APPROVAL: { fa: "نمره منتظر تأیید مدیر است", en: "Grade is waiting for an admin" },
};

export function missionIdForStage(stage: number): string {
  if (stage >= 6 && stage <= 8) return `A${stage}`;
  if (stage >= 1 && stage <= 5) return `M${stage}`;
  return "M1";
}

export function missionHref(stage: number): string {
  const id = missionIdForStage(stage);
  return stage >= 6 ? `/academy/advanced/${id}` : `/academy/missions/${id}`;
}

export function statusLabel(status: string, locale: Locale): string {
  return (STATUS[status] ?? { fa: "وضعیت نامشخص", en: "Status unavailable" })[locale];
}

export function noticeLabel(kind: string | undefined, locale: Locale): string {
  if (!kind) return locale === "fa" ? "اعلان" : "Notice";
  return (NOTICE[kind] ?? { fa: "اعلان داشبورد", en: "Dashboard notice" })[locale];
}

export function nextStep(input: {
  signedIn: boolean;
  status: string | null;
  stage: number;
  locale: Locale;
}): NextStep {
  const { signedIn, status, stage, locale } = input;
  const fa = locale === "fa";
  if (!signedIn) {
    return {
      heading: fa ? "اول وارد شوید" : "Start by signing in",
      body: fa
        ? "اگر دعوت‌نامه دارید، همان پیوند را باز کنید و حساب بسازید. اگر قبلاً ثبت‌نام کرده‌اید، وارد شوید. رمز گم‌شده ایمیلی نمی‌شود؛ از گفتگوی پشتیبانی بخواهید مالک آکادمی یک پیوند ۳۰ دقیقه‌ای بدهد."
        : "Open the cohort invite to create an account, or log in if you already joined. A forgotten password is not emailed. Ask in the support chat and the owner will give you a one-time link that expires in 30 minutes.",
      href: "/login",
      cta: fa ? "ورود" : "Log in",
    };
  }
  const href = missionHref(stage);
  const id = missionIdForStage(stage);
  if (status === "LESSON_OPEN" || status === "QUIZ_ASSESSED") {
    return {
      heading: fa ? `درس ${id} را بخوانید و آزمون را کامل بفرستید` : `Read ${id} and submit the full quiz`,
      body: fa
        ? "همه سؤال‌ها لازم است. تأیید آزمون فقط تکلیف عملی را باز می‌کند و درس بعدی را باز نمی‌کند. اگر آزمون رد شد، همان درس را دوباره بخوانید و آزمون را تکرار کنید."
        : "Answer every question. Quiz approval only opens the practical. It does not open the next lesson. If the quiz is not approved, reread this lesson and retake it.",
      href,
      cta: fa ? "رفتن به درس" : "Open the lesson",
    };
  }
  if (status === "QUIZ_SUBMITTED" || status === "PRACTICAL_SUBMITTED") {
    return {
      heading: fa ? "منتظر بررسی Echo بمانید" : "Wait for Echo's review",
      body: fa
        ? "چیزی را دوباره ارسال نکنید و درس بعدی را از نشانی باز نکنید. زمان نمره‌دهی تضمین نشده. نتیجه همین‌جا و در اعلان‌ها می‌آید. تلگرام اختیاری است."
        : "Do not resubmit and do not open the next lesson by URL. Grading time is not guaranteed. The result appears here and in notifications. Telegram is optional.",
      href: "/progress",
      cta: fa ? "ماندن در داشبورد" : "Stay on the dashboard",
    };
  }
  if (status === "ASSIGNMENT_ISSUED" || status === "REMEDIAL_ISSUED") {
    return {
      heading: fa ? "تکلیف را انجام دهید و یک سند بفرستید" : "Do the assignment and upload a document",
      body: fa
        ? "موعد به وقت آمستردام و وقت دستگاه شما نشان داده می‌شود. حداکثر ۱۲ فایل و هر کدام ۲۰ مگابایت: PDF، DOCX، TXT، MD، PNG، JPG. عکس HEIC گوشی پذیرفته نمی‌شود؛ آن را JPEG کنید. فقط تصویر کافی نیست. نام فارسی فایل مشکلی ندارد. بعد از آپلود، ثبت نهایی را بزنید."
        : "The deadline is shown in Europe/Amsterdam and in your device time. Up to 12 files, 20 MiB each: PDF, DOCX, TXT, MD, PNG, or JPG. Phone HEIC photos are rejected; export JPEG. Screenshots alone are not enough. Persian filenames are fine. After the files upload, press final submit.",
      href: "/progress#upload",
      cta: fa ? "رفتن به بارگذاری" : "Go to upload",
    };
  }
  if (status === "AWAITING_SENIOR_MENTOR" || status === "DOSSIER_READY") {
    return {
      heading: fa ? "هشت هفته تمام شد" : "The eight weeks are complete",
      body: fa
        ? "تمرین مثبت مرحله ۸ پرونده را برای منتور ارشد آماده کرد. مرحله ۹ و فارغ‌التحصیلی خودکار وجود ندارد. جلسه جمع‌بندی را با مالک آکادمی هماهنگ کنید."
        : "A positive stage 8 practical prepared your dossier for the senior mentor. There is no stage 9 and no automatic graduation. Arrange the wrap-up session with the academy owner.",
      href: null,
      cta: null,
    };
  }
  return {
    heading: fa ? "داشبورد را تازه کنید" : "Refresh the dashboard",
    body: fa
      ? "وضعیت این هفته هنوز مشخص نیست. اگر خطا ماند، از گفتگوی پشتیبانی بپرسید."
      : "This week's status is not available yet. If the error stays, ask in the support chat.",
    href: "/progress",
    cta: fa ? "تازه‌سازی" : "Refresh",
  };
}

export function formatDualTime(isoOrUnix: string | number): { amsterdam: string; local: string } {
  const date = typeof isoOrUnix === "number" ? new Date(isoOrUnix * 1000) : new Date(isoOrUnix);
  const format = (timeZone?: string) => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    } catch {
      return date.toISOString();
    }
  };
  return { amsterdam: format("Europe/Amsterdam"), local: format(undefined) };
}
