import type { Text } from "./contracts";

/** Lesson copy grounded in the NotebookLM exports. Financial terms stay in English. */
export type LessonPatch = {
  title: Text;
  core: Text;
  trap: Text;
  reality: Text;
  question: Text;
  workedExample: Text;
};

const tx = (en: string, fa: string): Text => ({ en, fa });

export const LESSON_PATCH: Record<string, LessonPatch> = {
  "M1-L1": {
    title: tx("Base, quote, spread, and pip", "پایه، نقل، spread و pip"),
    core: tx(
      "A pair prices the base currency in the quote currency. Bid is the sell side of the base, ask is the buy side, and spread is the gap between them. Spread is a cost. A pip is a price step, and a lot is a contract size. None of these is an entry signal.",
      "یک جفت، ارز پایه را با ارز نقل قیمت می‌دهد. Bid سمت فروش پایه است و ask سمت خرید. Spread فاصله آن‌ها و یک هزینه است. Pip یک گام قیمت است و lot اندازه قرارداد. هیچ‌کدام سیگنال ورود نیستند.",
    ),
    trap: tx(
      "The common mistake is to chase a candle and ignore spread, session, and pip value.",
      "اشتباه رایج این است که کندل را دنبال کنید و spread، جلسه، و pip value را نادیده بگیرید.",
    ),
    reality: tx(
      "Spot FX is mostly OTC. Futures are exchange-listed. Margin is collateral the broker holds. It is not the same thing as the loss you planned.",
      "اسپات بیشتر OTC است. Futures در بورس فهرست می‌شوند. Margin وثیقه‌ای است که بروکر نگه می‌دارد و با زیان برنامه‌ریزی‌شده یکی نیست.",
    ),
    question: tx(
      "If you watch only the ask, which cost do you fail to see?",
      "اگر فقط ask را ببینید، کدام هزینه را نمی‌بینید؟",
    ),
    workedExample: tx(
      "Illustrative only, not a market quote and not a trade. Equity 10,000. A 1% risk budget is 100. If an illustrative EURUSD stop is 20 pips and the illustrative point value is 10 per lot per pip, size = (10,000 × 0.01) / (20 × 10) = 0.50 lot. A target 40 pips away is 1:2 before costs. Costs must be subtracted before you call the reward net. This is not permission to trade.",
      "فقط آموزشی است، نه قیمت بازار و نه معامله. Equity برابر 10,000. بودجه ریسک ۱٪ برابر 100 است. اگر stop آموزشی EURUSD برابر 20 pip و point value آموزشی 10 به‌ازای هر lot در هر pip باشد، اندازه = (10,000 × 0.01) / (20 × 10) = 0.50 lot. هدف ۴۰ pip دورتر، قبل از هزینه ۱:۲ است. پیش از گفتن net باید هزینه کم شود. این اجازه معامله نیست.",
    ),
  },
  "M1-L2": {
    title: tx("Sessions, leverage, and the 1% budget", "جلسه‌ها، اهرم، و بودجه ۱٪"),
    core: tx(
      "London and New York are the preferred sessions in the framework. Leverage lets you control a larger position than the cash you post. The universal risk rule still caps planned loss at 1.0% of equity per trade.",
      "در چارچوب، جلسه‌های ترجیحی London و New York هستند. اهرم اجازه می‌دهد با وجه کمتر موقعیت بزرگ‌تری کنترل کنید. قانون جهانی ریسک همچنان زیان برنامه‌ریزی‌شده را به ۱٫۰٪ از equity در هر معامله محدود می‌کند.",
    ),
    trap: tx(
      "Free margin is not a reason to raise size. A mental stop is not allowed: the stop must exist before the order.",
      "Margin آزاد دلیل بزرگ‌کردن اندازه نیست. Mental stop مجاز نیست: stop باید پیش از سفارش وجود داشته باشد.",
    ),
    reality: tx(
      "Size comes from the formula Lot Size = (Equity × Risk %) / (Stop Distance × Point Value). The stop is a hard structural invalidation, not a feeling.",
      "اندازه از فرمول Lot Size = (Equity × Risk %) / (Stop Distance × Point Value) می‌آید. Stop ابطال ساختاری سخت است، نه احساس.",
    ),
    question: tx(
      "Why can free margin never, by itself, set the lot?",
      "چرا margin آزاد به‌تنهایی نمی‌تواند lot را تعیین کند؟",
    ),
    workedExample: tx(
      "Same illustrative account: equity 10,000, risk 100. If you widen the stop from 20 pips to 40 pips and keep the same point value of 10, size falls to 0.25 lot. The dollar risk stays 100. A wider stop is not a larger budget.",
      "همان حساب آموزشی: equity برابر 10,000 و ریسک 100. اگر stop از 20 pip به 40 pip برسد و point value همان 10 بماند، اندازه به 0.25 lot کاهش می‌یابد. ریسک دلاری همان 100 می‌ماند. Stop پهن‌تر بودجه بزرگ‌تر نیست.",
    ),
  },
  "M2-L1": {
    title: tx("Liquidity, venues, and order types", "نقدینگی، محل اجرا، و انواع سفارش"),
    core: tx(
      "Stage 2 is about who trades, where orders go, and what an order type actually does. Limit seeks an equal-or-better price. Stop activates when price trades through the level. OTC and exchange-traded products do not share the same execution path. Slippage and fees are costs.",
      "مرحله ۲ درباره این است که چه کسی معامله می‌کند، سفارش کجا می‌رود، و نوع سفارش واقعاً چه می‌کند. Limit قیمت مساوی یا بهتر می‌خواهد. Stop وقتی فعال می‌شود که قیمت از سطح عبور کند. مسیر OTC و محصول بورس یکی نیست. Slippage و کارمزد هزینه‌اند.",
    ),
    trap: tx(
      "A liquidity sweep beyond a swing is a possible run on resting orders. By itself it is not an entry. A wick touch does not prove a limit was filled.",
      "Liquidity sweep فراتر از یک swing ممکن است جمع‌شدن سفارش‌های منتظر باشد. به‌تنهایی ورود نیست. لمس فتیله ثابت نمی‌کند Limit پر شده است.",
    ),
    reality: tx(
      "PDH, PDL, PWH, and PWL are reference levels where liquidity often rests. The framework's conditional note is that selling at PDH is more favorable than selling at PDL only when the setup is already valid. It is not a standing order to sell.",
      "PDH، PDL، PWH و PWL سطوح مرجع‌اند که نقدینگی اغلب آنجا می‌ماند. یادداشت مشروط چارچوب این است که فروش در PDH، فقط وقتی ستاپ از قبل معتبر است، از فروش در PDL مساعدتر است. این دستور همیشگی فروش نیست.",
    ),
    question: tx(
      "What does a sweep prove, and what does it not prove?",
      "یک sweep چه چیزی را ثابت می‌کند و چه چیزی را ثابت نمی‌کند؟",
    ),
    workedExample: tx(
      "Illustrative path, not a signal. Price trades through a prior-day high and comes back. You record the sweep. You do not enter because there is not yet a closed Market Structure Shift. The 1% budget and the hard stop are still unused because there is no valid plan.",
      "مسیر آموزشی است، نه سیگنال. قیمت از سقف روز قبل عبور می‌کند و برمی‌گردد. Sweep را ثبت می‌کنید. وارد نمی‌شوید چون هنوز Market Structure Shift بسته‌شده ندارید. بودجه ۱٪ و stop سخت هنوز استفاده نمی‌شوند چون طرح معتبری نیست.",
    ),
  },
  "M3-L1": {
    title: tx("Timeframes and structure tools", "تایم‌فریم‌ها و ابزار ساختار"),
    core: tx(
      "Directional reading uses H4 and H1. Execution reading uses M15 and M5. M1 was mentioned in the archive and is not the execution standard here. Structure words in the sources are OB, BOS, CHoCH, FVG, and MSS. MA50 and MA200 are named, but no crossover rule, applied price, or shift was recovered, so they stay descriptive.",
      "خواندن جهت با H4 و H1 است. خواندن اجرا با M15 و M5 است. M1 در آرشیو آمده و اینجا استاندارد اجرا نیست. واژه‌های ساختار در منابع OB، BOS، CHoCH، FVG و MSS هستند. MA50 و MA200 نام برده شده‌اند، اما قانون تقاطع، قیمت اعمال، یا شیفت بازیابی نشده، پس فقط توصیفی می‌مانند.",
    ),
    trap: tx(
      "Indicators do not prove a predictive edge. A fair value gap or an order block is a location to study, not permission to click.",
      "اندیکاتور لبه پیش‌بینی را ثابت نمی‌کند. Fair value gap یا order block محل مطالعه است، نه اجازه کلیک.",
    ),
    reality: tx(
      "Market Maker Scout v3.0 states a sweep-reversal path: confirmed sweep of a visible high or low, then a closed-candle MSS through a protected level, then displacement, then a defined zone (FVG or OB). The stop is structural invalidation beyond the sweep extreme or swing. Minimum net R:R is 1:2. Risk stays at 1.0%.",
      "Market Maker Scout v3.0 مسیر sweep-reversal را این‌طور می‌گوید: sweep تأییدشده از سقف یا کف دیده‌شده، سپس MSS با کندل بسته‌شده از سطح محافظت‌شده، سپس displacement، سپس ناحیه مشخص (FVG یا OB). Stop ابطال ساختاری فراتر از انتهای sweep یا swing است. حداقل net R:R برابر 1:2 است. ریسک روی ۱٫۰٪ می‌ماند.",
    ),
    question: tx(
      "Which timeframe pair is for direction, and which is for execution?",
      "کدام جفت تایم‌فریم برای جهت است و کدام برای اجرا؟",
    ),
    workedExample: tx(
      "Illustrative EURUSD numbers, not a live price. Direction is read on H4/H1. A closed MSS appears on M15. Stop distance is 20 pips beyond the sweep extreme. Equity 10,000, risk 100, illustrative point value 10, so size is 0.50 lot. The target is at least 40 pips away so reward/risk is 2 before costs. If costs eat the reward below 1:2, the plan fails the net test. No order is implied.",
      "اعداد آموزشی EURUSD است، نه قیمت زنده. جهت روی H4/H1 خوانده می‌شود. یک MSS بسته‌شده روی M15 دیده می‌شود. فاصله stop برابر 20 pip فراتر از انتهای sweep است. Equity برابر 10,000، ریسک 100، point value آموزشی 10، پس اندازه 0.50 lot است. هدف حداقل ۴۰ pip دورتر است تا نسبت پاداش به ریسک پیش از هزینه ۲ باشد. اگر هزینه پاداش را زیر 1:2 ببرد، طرح در آزمون net رد می‌شود. سفارشی نتیجه نمی‌شود.",
    ),
  },
  "M4-L1": {
    title: tx("Macro chain, not one print", "زنجیره کلان، نه یک عدد"),
    core: tx(
      "The Macro Coordinator chain is: data, surprise versus expectations, trend, composition, revisions, the current driver, the Fed reaction function, the change in Fed expectations, US2Y, US10Y, real yields, DXY, VIX, cross-asset confirmation, then Dow Jones and gold. You never skip from one economic number to an asset-price prediction.",
      "زنجیره Macro Coordinator این است: داده، surprise در برابر انتظار، روند، ترکیب، revisions، محرک فعلی، تابع واکنش Fed، تغییر انتظار از Fed، US2Y، US10Y، real yields، DXY، VIX، تأیید بین‌بازاری، سپس Dow Jones و طلا. هرگز از یک عدد اقتصادی مستقیم به پیش‌بینی قیمت دارایی نپرید.",
    ),
    trap: tx(
      "A hot CPI print is not, by itself, a gold or dollar trade. Headline, core, and underlying inflation answer different questions. An unchanged policy rate can still reprice expectations if the statement or the path changes.",
      "یک چاپ داغ CPI به‌تنهایی معامله طلا یا دلار نیست. Headline، core، و تورم زیربنایی سؤال‌های متفاوتی را جواب می‌دهند. نرخ سیاستی بدون تغییر هم می‌تواند انتظار را دوباره قیمت‌گذاری کند اگر بیانیه یا مسیر عوض شود.",
    ),
    reality: tx(
      "INFLATION_ENGINE reads CPI and PCE on level, direction, momentum, breadth, and persistence. LABOR_ENGINE reads NFP, unemployment, wages, JOLTS, and claims. FED_POLICY_ENGINE reads the statement, the Dot Plot, the SEP, and implied probabilities. Separate the immediate reaction from the durable effect.",
      "INFLATION_ENGINE مقدار CPI و PCE را در سطح، جهت، شتاب، گستردگی، و ماندگاری می‌خواند. LABOR_ENGINE مقدار NFP، بیکاری، دستمزد، JOLTS و claims را می‌خواند. FED_POLICY_ENGINE بیانیه، Dot Plot، SEP و احتمال‌های ضمنی را می‌خواند. واکنش فوری را از اثر ماندگار جدا کنید.",
    ),
    question: tx(
      "What must sit between an economic release and any idea about price?",
      "بین یک انتشار اقتصادی و هر ایده درباره قیمت چه چیزهایی باید باشد؟",
    ),
    workedExample: tx(
      "Illustrative checklist, not a forecast. Actual CPI is above the forecast, the previous print is revised, and US2Y rises while DXY is mixed. You stop. You do not invent a gold entry. You record surprise, revision, and whether Fed expectations actually changed. The 1% risk budget is irrelevant until a separate structural plan exists, and this macro step does not create that plan.",
      "چک‌لیست آموزشی است، نه پیش‌بینی. CPI واقعی بالاتر از forecast است، چاپ قبلی revise شده، و US2Y بالا می‌رود در حالی که DXY مخلوط است. متوقف می‌شوید. ورود طلا نمی‌سازید. Surprise، revision، و این را که آیا انتظار از Fed واقعاً عوض شده ثبت می‌کنید. بودجه ریسک ۱٪ تا وقتی طرح ساختاری جدا وجود ندارد بی‌ربط است، و این گام کلان آن طرح را نمی‌سازد.",
    ),
  },
  "M5-L1": {
    title: tx("Intermarket confirmation", "تأیید بین‌بازاری"),
    core: tx(
      "CROSS_ASSET_ENGINE looks at the yield curve (2s10s), TIPS real yields, DXY, VIX, and credit. The roadmap adds equities, gold, and oil. Correlation is regime-dependent. Confirmation is a check, not a second copy of the same reason.",
      "CROSS_ASSET_ENGINE به منحنی بازده (2s10s)، TIPS real yields، DXY، VIX و اعتبار نگاه می‌کند. نقشه راه سهام، طلا و نفت را هم اضافه می‌کند. همبستگی به رژیم بستگی دارد. تأیید یک بررسی است، نه کپی دوم همان دلیل.",
    ),
    trap: tx(
      "GDATA asks for a shared snapshot and an independent evaluation so two modules do not manufacture a consensus by double-counting one input.",
      "GDATA یک تصویر مشترک و یک ارزیابی مستقل می‌خواهد تا دو ماژول با دوبار شمردن یک ورودی اجماع نسازند.",
    ),
    reality: tx(
      "Macro bias describes pressure and environment. The coordinator says it is not an entry, a stop, or a target. In the gold grid notes, direction is argued from fundamentals and targets are read from grid levels. That grid is price geometry for gold only, not a signal.",
      "Macro bias فشار و محیط را توصیف می‌کند. هماهنگ‌کننده می‌گوید این ورود، stop، یا هدف نیست. در یادداشت‌های شبکه طلا، جهت از بنیادها استدلال می‌شود و هدف‌ها از سطوح شبکه خوانده می‌شوند. آن شبکه فقط هندسه قیمت برای طلاست، نه سیگنال.",
    ),
    question: tx(
      "Why is 'gold and the dollar moved together today' not yet confirmation?",
      "چرا «طلا و دلار امروز با هم حرکت کردند» هنوز تأیید نیست؟",
    ),
    workedExample: tx(
      "Illustrative snapshot, not a signal. Real yields up, DXY up, gold down on the first hour, then gold retraces while yields stay up. You label the first hour as the immediate reaction and the later retrace as unresolved. You do not average them into one trade. If you then write 'no trade this week', that is a valid conclusion only when it matches what was actually observed: you name the timestamped readings behind it (for example, 'real yields and DXY rose at 14:35 and gold retraced by 15:20, so the chain is unresolved'). A no-trade conclusion that does not match the data you recorded, or that has no timestamped reading behind it, is not grounded. If you have no timestamped data for a window, you write 'Observed reaction unavailable' and do not infer an intraday path from a daily close. Equity and the 1% budget stay unused.",
      "تصویر آموزشی است، نه سیگنال. Real yields بالا، DXY بالا، طلا در ساعت اول پایین، سپس طلا برمی‌گردد در حالی که بازده بالا می‌ماند. ساعت اول را واکنش فوری می‌نامید و بازگشت بعدی را حل‌نشده. آن‌ها را به یک معامله میانگین نمی‌کنید. اگر بعد بنویسید «این هفته معامله نمی‌کنم»، این نتیجه فقط وقتی معتبر است که با آنچه واقعاً مشاهده شد جور باشد: خوانش‌های دارای timestamp پشت آن را نام می‌برید (مثلاً «real yields و DXY ساعت ۱۴:۳۵ بالا رفتند و طلا تا ۱۵:۲۰ برگشت، پس زنجیره حل‌نشده است»). نتیجه‌ی «بدون معامله» که با داده‌ی ثبت‌شده‌ی شما نمی‌خواند، یا خوانش دارای timestamp پشتش نیست، مستند نیست. اگر برای یک پنجره داده‌ی دارای timestamp ندارید، می‌نویسید «Observed reaction unavailable» و مسیر درون‌روزی را از بسته‌شدن روزانه حدس نمی‌زنید. Equity و بودجه ۱٪ بدون استفاده می‌مانند.",
    ),
  },
  "A6-L1": {
    title: tx("A falsifiable hypothesis", "یک فرضیه ابطال‌پذیر"),
    core: tx(
      "Research starts by writing what would prove you wrong, which data are allowed, and which costs count, before you look at the outcome window. Inflation-engine rules in the archive require separating evidence from a story told after the print.",
      "پژوهش با نوشتن چیزی شروع می‌شود که شما را غلط ثابت می‌کند، اینکه کدام داده مجاز است، و کدام هزینه حساب می‌شود، پیش از دیدن پنجره نتیجه. قواعد موتور تورم در آرشیو می‌خواهد شواهد را از داستانی که بعد از چاپ گفته می‌شود جدا کنید.",
    ),
    trap: tx(
      "Changing the rule after you see the result is not an out-of-sample test. It is a new story.",
      "عوض کردن قاعده بعد از دیدن نتیجه، آزمون خارج از نمونه نیست. یک داستان جدید است.",
    ),
    reality: tx(
      "Look-ahead bias uses information that was not available at the decision time. Spread and fees belong in the test. A missing print stays missing. It is not filled with a convenient number.",
      "سوگیری نگاه به آینده از اطلاعاتی استفاده می‌کند که در زمان تصمیم موجود نبود. Spread و کارمزد داخل آزمون‌اند. چاپ گم‌شده گم‌شده می‌ماند و با عدد راحت پر نمی‌شود.",
    ),
    question: tx(
      "What has to be written down before the outcome window is opened?",
      "پیش از باز کردن پنجره نتیجه چه چیزی باید نوشته شده باشد؟",
    ),
    workedExample: tx(
      "Illustrative research note, not a result. Hypothesis: after a CPI surprise, the 0–5, 5–15 and 15–60 minute windows and the later session are recorded separately for EURUSD. Falsifier: if the later windows do not differ from a no-surprise sample after costs, the idea fails. You do not drop the losing days.",
      "یادداشت پژوهشی آموزشی است، نه نتیجه. فرضیه: بعد از surprise در CPI، پنجره‌های ۰ تا ۵، ۵ تا ۱۵ و ۱۵ تا ۶۰ دقیقه و جلسه‌ی بعدی برای EURUSD جدا ثبت می‌شوند. ابطال: اگر پنجره‌های بعدی بعد از هزینه با نمونه بدون surprise فرق نکنند، ایده شکست می‌خورد. روزهای بازنده را حذف نمی‌کنید.",
    ),
  },
  "A6-L2": {
    title: tx("Costs, sample, and failure", "هزینه، نمونه، و شکست"),
    core: tx(
      "A test that ignores spread can look profitable and still lose. Out-of-sample means the later window was not used to choose the rule. Document the failures in the same place as the passes.",
      "آزمونی که spread را نادیده می‌گیرد می‌تواند سودآور به نظر برسد و باز هم ببازد. خارج از نمونه یعنی پنجره بعدی برای انتخاب قاعده استفاده نشده است. شکست‌ها را همان‌جا که قبول‌ها را می‌نویسید ثبت کنید.",
    ),
    trap: tx(
      "Fitting many indicators until one path looks smooth is overfitting. RSI, Volume Profile, ZigZag, and Renko are named in the archive without a validated rule, so they are not a system.",
      "چیدن اندیکاتورهای زیاد تا یک مسیر صاف شود overfitting است. RSI، Volume Profile، ZigZag و Renko در آرشیو نام دارند بدون قاعده معتبر، پس سیستم نیستند.",
    ),
    reality: tx(
      "Market Maker Scout names three risk states: NORMAL, CAUTION, and HARD_BLOCK. A research note can use those words only for the risk rules that were actually stated: 1% cap, hard structural stop, and minimum 1:2.",
      "Market Maker Scout سه حالت ریسک را نام می‌برد: NORMAL، CAUTION، و HARD_BLOCK. یادداشت پژوهش فقط وقتی این واژه‌ها را به کار می‌برد که قاعده واقعاً گفته شده باشد: سقف ۱٪، stop ساختاری سخت، و حداقل 1:2.",
    ),
    question: tx(
      "Why is a smooth backtest without spread not evidence?",
      "چرا یک بک‌تست صاف بدون spread شاهد نیست؟",
    ),
    workedExample: tx(
      "Illustrative ledger. Gross reward on ten fictional events is 2.0R. Spread and fees take 0.4R. Net is 1.6R, still above 1:2 on this toy set. You still label it in-sample and you still write the three events that failed. You do not promote it to a live rule.",
      "دفتر آموزشی. پاداش ناخالص روی ده رویداد ساختگی 2.0R است. Spread و کارمزد 0.4R می‌گیرند. خالص 1.6R است و در این مجموعه اسباب‌بازی هنوز بالای 1:2 است. باز هم آن را درون‌نمونه می‌نامید و سه رویداد شکست‌خورده را می‌نویسید. آن را به قاعده زنده ارتقا نمی‌دهید.",
    ),
  },
  "A6-L3": {
    title: tx("What the sources do not give you", "آنچه منابع به شما نمی‌دهند"),
    core: tx(
      "The archive does not contain a complete, tested trading system. MA50 and MA200 have no recovered crossover rule. The gold grid intervals ($350 higher-timeframe, $50 lower-timeframe, midpoints $175 and $25) are geometry notes, not signals.",
      "آرشیو یک سیستم معامله کامل و آزموده‌شده ندارد. MA50 و MA200 قانون تقاطع بازیابی‌شده ندارند. فاصله‌های شبکه طلا (۳۵۰ در تایم‌فریم بالاتر، ۵۰ در پایین‌تر، نقطه میانی ۱۷۵ و ۲۵) یادداشت هندسه‌اند، نه سیگنال.",
    ),
    trap: tx(
      "Filling a gap in the notes with a rule you prefer is inventing, not studying.",
      "پر کردن جای خالی یادداشت‌ها با قاعده‌ای که دوست دارید اختراع است، نه مطالعه.",
    ),
    reality: tx(
      "Where the roadmap is broader than the recovered notes, stay with the chain, the risk rules, and the structure words that are actually written.",
      "جایی که نقشه راه از یادداشت‌های بازیابی‌شده گسترده‌تر است، روی زنجیره، قواعد ریسک، و واژه‌های ساختاری که واقعاً نوشته شده‌اند بمانید.",
    ),
    question: tx(
      "What should you do when a tool is named but its rule is missing?",
      "وقتی ابزاری نام دارد ولی قاعده‌اش نیست چه باید کرد؟",
    ),
    workedExample: tx(
      "You see MA50 and MA200 on an illustrative chart. You write: 'crossover rule not in the source.' You do not add 'buy when they cross.' The worked risk example stays the same 10,000 / 1% / hard stop / 1:2 sketch, marked illustrative.",
      "MA50 و MA200 را روی یک چارت آموزشی می‌بینید. می‌نویسید: «قانون تقاطع در منبع نیست.» اضافه نمی‌کنید «وقتی قطع کردند بخر.» مثال ریسک همان طرح 10,000 / ۱٪ / stop سخت / 1:2 می‌ماند و آموزشی علامت می‌خورد.",
    ),
  },
  "A7-L1": {
    title: tx("The three hard risk rules", "سه قاعده سخت ریسک"),
    core: tx(
      "Maximum risk is 1.0% of equity per trade. The stop is mandatory before the order. A mental stop is forbidden and is a HARD_BLOCK. Net reward to risk must be at least 1:2.",
      "حداکثر ریسک ۱٫۰٪ از equity در هر معامله است. Stop پیش از سفارش اجباری است. Mental stop ممنوع است و HARD_BLOCK است. نسبت پاداش خالص به ریسک باید حداقل 1:2 باشد.",
    ),
    trap: tx(
      "Moving the stop in your head after the click does not count. Raising size because margin is free does not count.",
      "جابه‌جا کردن stop در ذهن بعد از کلیک حساب نمی‌شود. بزرگ کردن اندازه چون margin آزاد است حساب نمی‌شود.",
    ),
    reality: tx(
      "Scout also names NORMAL and CAUTION. Those words do not relax the 1% cap, the hard stop, or the 1:2 floor.",
      "Scout همچنین NORMAL و CAUTION را نام می‌برد. این واژه‌ها سقف ۱٪، stop سخت، یا کف 1:2 را شل نمی‌کنند.",
    ),
    question: tx(
      "Which three failures force HARD_BLOCK even if the story sounds good?",
      "کدام سه شکست حتی اگر داستان خوب باشد HARD_BLOCK می‌سازند؟",
    ),
    workedExample: tx(
      "Illustrative account, not a position. Equity 10,000. Risk budget 100. Stop 20 pips, point value 10, size 0.50. Reward must be at least 40 pips before costs to print 1:2, and costs still have to be checked. A mental stop instead of the 20-pip structural stop blocks the plan even if the picture looks clean.",
      "حساب آموزشی است، نه موقعیت. Equity برابر 10,000. بودجه ریسک 100. Stop برابر 20 pip، point value برابر 10، اندازه 0.50. پاداش باید پیش از هزینه حداقل 40 pip باشد تا 1:2 چاپ شود، و هزینه هنوز باید بررسی شود. Mental stop به‌جای stop ساختاری ۲۰ pip طرح را مسدود می‌کند حتی اگر تصویر تمیز باشد.",
    ),
  },
  "A7-L2": {
    title: tx("Sizing is arithmetic", "اندازه حساب است"),
    core: tx(
      "Lot Size = (Equity × Risk %) / (Stop Distance × Point Value). Round down if the broker's lot step would otherwise push the loss over the budget. The archive does not give a universal point value, so any point value in class is illustrative.",
      "Lot Size = (Equity × Risk %) / (Stop Distance × Point Value). اگر گام lot بروکر زیان را از بودجه بیشتر کند، به پایین گرد کنید. آرشیو یک point value جهانی نمی‌دهد، پس هر point value در کلاس آموزشی است.",
    ),
    trap: tx(
      "Using a tighter stop only to justify a bigger lot, without a structural location, hides risk. It does not reduce it.",
      "تنگ کردن stop فقط برای توجیه lot بزرگ‌تر، بدون محل ساختاری، ریسک را پنهان می‌کند. آن را کم نمی‌کند.",
    ),
    reality: tx(
      "Demo or paper review is part of stage 7. No live-money activity is required to learn the arithmetic.",
      "مرور demo یا paper بخشی از مرحله ۷ است. برای یاد گرفتن حساب، فعالیت با پول زنده لازم نیست.",
    ),
    question: tx(
      "What happens to size when the stop distance doubles and the risk budget does not?",
      "وقتی فاصله stop دو برابر شود و بودجه ریسک نه، اندازه چه می‌شود؟",
    ),
    workedExample: tx(
      "Equity 10,000, budget 100, point value 10. Stop 20 pips → 0.50 lot. Stop 40 pips → 0.25 lot. Dollar risk stays 100 in both illustrative rows. A 15-pip target against a 20-pip stop is below 1:2 even before costs, so it is blocked.",
      "Equity برابر 10,000، بودجه 100، point value برابر 10. Stop برابر 20 pip می‌شود 0.50 lot. Stop برابر 40 pip می‌شود 0.25 lot. ریسک دلاری در هر دو ردیف آموزشی 100 می‌ماند. هدف ۱۵ pip در برابر stop بیست pip حتی پیش از هزینه زیر 1:2 است، پس مسدود است.",
    ),
  },
  "A7-L3": {
    title: tx("Drawdown and the journal", "افت سرمایه و دفتر"),
    core: tx(
      "Stage 7 asks you to understand drawdown, leverage, scenarios, and a journal. A string of illustrative losses at 1% is still a drawdown. Leverage does not make that string smaller.",
      "مرحله ۷ می‌خواهد افت سرمایه، اهرم، سناریوها، و دفتر را بفهمید. رشته‌ای از زیان‌های آموزشی در سطح ۱٪ هنوز افت سرمایه است. اهرم آن رشته را کوچک‌تر نمی‌کند.",
    ),
    trap: tx(
      "Raising risk after a loss to 'get it back' breaks the 1% cap on purpose.",
      "بالا بردن ریسک بعد از زیان برای «پس گرفتن» عمداً سقف ۱٪ را می‌شکند.",
    ),
    reality: tx(
      "The journal records the plan, the stop type, the size arithmetic, and whether the result matched the invalidation. It does not invent a new signal.",
      "دفتر طرح، نوع stop، حساب اندازه، و اینکه نتیجه با ابطال جور بود یا نه را ثبت می‌کند. سیگنال جدید نمی‌سازد.",
    ),
    question: tx(
      "After three illustrative 1% losses, what is the risk cap on the next plan?",
      "بعد از سه زیان آموزشی ۱٪، سقف ریسک طرح بعدی چیست؟",
    ),
    workedExample: tx(
      "Start 10,000. Three full 1% losses, ignoring the path of equity for a moment, are a 300 currency drawdown if each were taken on the original 10,000. Recalculate 1% on the remaining equity before any next illustrative plan. Still no live order.",
      "شروع 10,000. سه زیان کامل ۱٪، اگر هر کدام روی 10,000 اولیه گرفته شده باشد، افت 300 واحد است. پیش از هر طرح آموزشی بعدی، ۱٪ را روی equity باقی‌مانده دوباره حساب کنید. هنوز سفارش زنده نیست.",
    ),
  },
  "A8-L1": {
    title: tx("One release, three instruments", "یک انتشار، سه ابزار"),
    core: tx(
      "The capstone notebook compares EURUSD, USDJPY, and XAUUSD reactions to the same selected release. Write the immediate move and the later repricing in separate rows. Do not collapse them.",
      "دفتر پایانی واکنش EURUSD، USDJPY و XAUUSD را به یک انتشار انتخاب‌شده مقایسه می‌کند. حرکت فوری و قیمت‌گذاری دوباره بعدی را در ردیف‌های جدا بنویسید. آن‌ها را یکی نکنید.",
    ),
    trap: tx(
      "A shared macro story is not three identical trades. Each instrument still needs its own structure plan, and this module does not supply that plan.",
      "یک داستان کلان مشترک سه معامله یکسان نیست. هر ابزار هنوز طرح ساختار خودش را می‌خواهد، و این ماژول آن طرح را نمی‌دهد.",
    ),
    reality: tx(
      "Use the coordinator chain and the cross-asset check. Direction, if you discuss it, is pressure, not an order. The Master Orchestrator in the scout notes is the place that would refuse a plan missing the hard stop or the 1:2, not a button that sends orders.",
      "از زنجیره هماهنگ‌کننده و بررسی بین‌بازاری استفاده کنید. جهت، اگر درباره‌اش حرف می‌زنید، فشار است نه سفارش. Master Orchestrator در یادداشت‌های Scout جایی است که طرح بدون stop سخت یا 1:2 را رد می‌کند، نه دکمه‌ای که سفارش بفرستد.",
    ),
    question: tx(
      "What two time slices must the capstone keep separate?",
      "دفتر پایانی کدام دو برش زمانی را باید جدا نگه دارد؟",
    ),
    workedExample: tx(
      "Illustrative release, not history. In the 0–5 minute window EURUSD dips, USDJPY rises, and gold dips. By the 15–60 minute window gold retraces and the dollar move fades, and the later session is written as its own row. The notebook's conclusion is 'immediate and later disagree,' not a trade. Risk arithmetic stays the 10,000 / 100 / hard-stop sketch, written as a separate conditional Final Paper Plan.",
      "انتشار آموزشی است، نه تاریخ. در پنجره‌ی ۰ تا ۵ دقیقه EURUSD پایین می‌آید، USDJPY بالا می‌رود، و طلا پایین می‌آید. تا پنجره‌ی ۱۵ تا ۶۰ دقیقه طلا برمی‌گردد و حرکت دلار کم‌رنگ می‌شود، و جلسه‌ی بعدی ردیف جداگانه دارد. نتیجه دفتر این است که «فوری و بعدی ناسازگارند»، نه یک معامله. حساب ریسک همان طرح 10,000 / 100 / stop سخت می‌ماند، به‌صورت پلن کاغذی نهایی شرطی و جدا.",
    ),
  },
  "A8-L2": {
    title: tx("Already priced in", "از قبل در قیمت بوده"),
    core: tx(
      "Compare actual, forecast, previous, and revisions. A number that matches what was already expected can print and still leave the later window flat. That is evidence about expectations, not a failed indicator.",
      "واقعی، forecast، قبلی، و revisions را مقایسه کنید. عددی که با انتظار قبلی جور است می‌تواند چاپ شود و پنجره بعدی تخت بماند. این شاهد درباره انتظارات است، نه شکست یک اندیکاتور.",
    ),
    trap: tx(
      "Calling every flat reaction 'noise' skips the question of what was already in the price.",
      "گفتن اینکه هر واکنش تخت «نویز» است، سؤال «چه چیزی از قبل در قیمت بود» را دور می‌زند.",
    ),
    reality: tx(
      "Fed expectations can move without a rate change, through the statement, the dots, or the path. US2Y is the near policy-sensitive yield in the chain. It is not an entry trigger.",
      "انتظار از Fed می‌تواند بدون تغییر نرخ جابه‌جا شود، از راه بیانیه، نقطه‌ها، یا مسیر. US2Y در زنجیره بازده نزدیک و حساس به سیاست است. ماشه ورود نیست.",
    ),
    question: tx(
      "What four fields do you compare on a release before you talk about price?",
      "پیش از حرف زدن درباره قیمت، کدام چهار فیلد انتشار را مقایسه می‌کنید؟",
    ),
    workedExample: tx(
      "Illustrative CPI: actual equals forecast, previous is revised up, US2Y barely moves, gold's first spike fades. You write 'little new information versus expectations; revision noted.' You do not add a buy. The Final Paper Plan is still written from structure, as a conditional plan with a hard stop, 1% risk, and net 1:2.",
      "CPI آموزشی: واقعی برابر forecast است، قبلی به بالا revise شده، US2Y کم حرکت می‌کند، جهش اول طلا محو می‌شود. می‌نویسید «اطلاعات تازه نسبت به انتظار کم است؛ revision ثبت شد.» خرید اضافه نمی‌کنید. پلن کاغذی نهایی همچنان از ساختار نوشته می‌شود، به‌صورت پلن شرطی با stop سخت، ریسک ۱٪ و 1:2 خالص.",
    ),
  },
  "A8-L3": {
    title: tx("What the capstone refuses", "آنچه دفتر پایانی رد می‌کند"),
    core: tx(
      "The notebook can be finished without a single order. It is done when the chain, the immediate-versus-later split, and the risk rules are written clearly for EURUSD, USDJPY, and XAUUSD.",
      "دفتر می‌تواند بدون حتی یک سفارش تمام شود. وقتی تمام است که زنجیره، جدایی فوری از بعدی، و قواعد ریسک برای EURUSD، USDJPY و XAUUSD روشن نوشته شده باشند.",
    ),
    trap: tx(
      "Turning the notebook into signals because the page looks complete is the last retail trap in the course.",
      "تبدیل دفتر به سیگنال چون صفحه کامل به نظر می‌رسد آخرین تله خرده‌فروشی دوره است.",
    ),
    reality: tx(
      "A positive practical in the academy unlocks nothing beyond the senior-mentor review. The sources do not describe graduation, a funded account, or a live book.",
      "یک تمرین مثبت در آکادمی چیزی فراتر از مرور منتور ارشد را باز نمی‌کند. منابع فارغ‌التحصیلی، حساب تأمین‌شده، یا دفتر زنده را توصیف نمی‌کنند.",
    ),
    question: tx(
      "What would make a finished-looking notebook still incomplete?",
      "چه چیزی یک دفتر ظاهراً تمام را هنوز ناقص می‌کند؟",
    ),
    workedExample: tx(
      "You have three illustrative rows and a clean 0.50-lot arithmetic example. You still mark the point value as illustrative, the prices as not real, and the conclusion as 'study notes.' A mental stop anywhere in the rows would be a HARD_BLOCK, so you leave the stop structural or you leave the row blank.",
      "سه ردیف آموزشی و یک مثال تمیز حساب 0.50 lot دارید. باز هم point value را آموزشی، قیمت‌ها را غیرواقعی، و نتیجه را «یادداشت مطالعه» علامت می‌زنید. یک mental stop در هر ردیف HARD_BLOCK است، پس stop را ساختاری می‌گذارید یا ردیف را خالی می‌گذارید.",
    ),
  },
};
