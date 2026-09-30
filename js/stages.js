// Method constants: the nine stages (paper section 4, ARCHITECTURE 3.3) and the two checkpoints (5.3).
// Hebrew stage titles follow the conference deck's infographic, except where the deck's wording
// contradicts the paper, which wins (CLAUDE.md): stage 2 labels and does not organise (4.2); stage 3
// builds theoretical contrasts, not opposites (4.3, 8); stage 4 searches the data for the constructed
// antithesis, which the paper distinguishes from negative case analysis (5.2); stage 8 maps relations
// among axes, "not a list of themes" (4.8). The deck's title is kept as `deck` and shown as a second
// line in the method section. This is UI text about the method, not run content: every run value
// comes from data/demo-run.json or the live API.

export const STAGES = [
  {
    n: 1, persona: 'THE MINER', agent: 'miner', hue: 'var(--a1)', sight: 'full',
    title: 'זיהוי יחידות משמעות בסיסיות',
    about: 'בחירת קטעים מתוך הראיונות, ביטוי, מטאפורה או אמירה, שנרשמים כמשמעותיים. המשמעות בשלב הזה זמנית ואינה דורשת הצדקה. הכלל הוא רוחב ולא סלקטיביות: כשיש ספק, כוללים. כל יחידה נשמרת מילה במילה, כי פרפרזה דוחסת ומוחקת את המרקם שיידרש בשלב 4.',
    receives: 'ראיון אחד בכל פעם, בטקסט מלא',
    returns: 'יחידות משמעות: ציטוטים מדויקים ושורה על כל אחד',
  },
  {
    n: 2, persona: 'THE BOTANIST', agent: 'botanist', hue: 'var(--a2)', sight: 'partial',
    title: 'תיוג תיאורי ראשוני', deck: 'תיוג וארגון ראשוני',
    about: 'לכל יחידה ניתנת תווית תיאורית קצרה, שתיים עד ארבע מילים, קרובה לשפה של המרואיינים. בלי מושגים תאורטיים: "תחושה שמסתכלים עליי בעבודה" ולא "מעקב מופנם". המאמר רואה בשלב הזה איפוק ולא ניתוח. תווית תאורטית כאן מכריעה מראש את מה שהשלבים הבאים אמורים לגלות.',
    receives: 'יחידות המשמעות בלבד, בלי שאר הראיון',
    returns: 'תוויות תיאוריות, וכל יחידה משויכת לתווית אחת',
  },
  {
    n: 3, persona: 'THE ARTIST', agent: 'artist', hue: 'var(--a3)', sight: 'none',
    title: 'בניית ניגודים תאורטיים', deck: 'הבניית הפכים פוטנציאליים',
    about: 'כאן נכנס המהלך הדיאלקטי. לכל תווית בונים ניגוד: איך הייתה נראית העמדה התאורטית החלופית. לא היפוך לוגי ולא מילה הפוכה, אלא חלופה שנשענת על הספרות ועל דמיון ממושמע. הסוכן עובד מהתווית בלבד, בלי לראות את הראיונות, כדי שהניגוד לא ייגרר אל מה שהנתונים כבר אומרים. הניגוד הוא השערה; שלב 4 יבחן אותה.',
    receives: 'התוויות בלבד. הראיונות חתומים',
    returns: 'ניגוד תאורטי אחד לכל תווית, עם נימוק',
  },
  {
    n: 4, persona: 'THE DETECTIVE', agent: 'detective', hue: 'var(--a4)', sight: 'full',
    title: 'חיפוש הניגודים בנתונים', deck: 'איתור עדויות סותרות בנתונים',
    about: 'חזרה לראיונות. לכל זוג של תווית וניגוד שואלים שאלה אמפירית: האם יש בנתונים מופע, ולו עקיף, של הניגוד? אם כן, הזוג נשמר. אם לא, הוא נופל. ציטוט מילולי אחד מספיק; ניגוד שאפשר להגן עליו רק מהספרות, בלי עדות בטקסט, נופל. זה מעגל העיגון הראשון.',
    receives: 'כל הראיונות, וכל זוגות התווית והניגוד',
    returns: 'לכל זוג: נשמר או נפל, עם ציטוטים; וסיכום של דפוס ההישרדות',
  },
  {
    n: 5, persona: 'THE PHYSICIST', agent: 'physicist', hue: 'var(--a5)', sight: 'none',
    title: 'הגדרת קצוות על ציר',
    about: 'כל זוג ששרד הופך לציר. התווית והניגוד הם שני הקצוות, והציר כבר אינו בינארי אלא רצף שעליו אפשר למקם עמדות. זה הסימן המבני של השיטה: במקום קטגוריה שיחידה שייכת אליה או לא, טווח. המחיר: צריך לנסח מה הממד שהטווח מייצג. גם השלב הזה נעשה בלי הנתונים.',
    receives: 'הזוגות ששרדו בלבד, בלי הציטוטים שאישרו אותם',
    returns: 'צירים: שני קצוות, הממד שביניהם ועמדות משוערות',
  },
  {
    n: 6, persona: 'THE CHEF', agent: 'chef', hue: 'var(--a6)', sight: 'full',
    title: 'מציאת נקודות אמצע וגוונים',
    about: 'חזרה שנייה לנתונים. מחפשים מקרים שנמצאים בין הקצוות: אמביוולנטיות, מעבר, תנודה, עמדה חלקית. נקודות האמצע לא נבנות מראש, הן נמצאות. ציר שיש בו רק קצוות הוא ציר שביר. לפי המאמר, כאן לרוב נמצא החומר המעניין ביותר: ציטוטים שלא נראו שייכים לשום מקום בקריאה הראשונה.',
    receives: 'כל הראיונות, והצירים',
    returns: 'לכל ציר: נקודות אמצע עם ציטוטים ומיקום, או סימון כשביר',
  },
  {
    n: 7, persona: 'THE CARTOGRAPHER', agent: 'cartographer', hue: 'var(--a7)', sight: 'partial',
    title: 'המשגה משנית של הרצף',
    about: 'נותנים לציר שם תאורטי. השם אינו תיאור של הקצוות אלא של הממד שלאורכו הם משתנים, והוא חייב להתאים לכל הטווח, כולל נקודות האמצע. זה המהלך הראשון שבו אוצר מילים תאורטי נכנס במפורש, ולכן כאן נמצאת נקודת העצירה השנייה: החוקרת בוחרת בין שמות חלופיים.',
    receives: 'הצירים ונקודות האמצע עם הציטוטים שלהן',
    returns: 'הגדרה לכל ציר ושלושה שמות אפשריים',
  },
  {
    n: 8, persona: 'THE COMPOSER', agent: 'composer', hue: 'var(--a8)', sight: 'none',
    title: 'מיפוי הקשרים בין הצירים', deck: 'הצלבת צירים ותמות',
    about: 'בודקים את היחסים בין הצירים: מקבילים (אותה דינמיקה מזוויות שונות), ניצבים (ממדים נפרדים שיכולים להשתנות יחד) או היררכיים (ציר אחד מעצב את המשמעות של אחר). התוצר הוא מפה של יחסים, לא טיפולוגיה של אנשים. השלב נעשה מהשמות וההגדרות בלבד, בלי הנתונים ובלי התוויות. הסוכן יודע רק אם כל ציר אוכלס בשלב 6: ציר שביר לא יהיה ציר ליבה, והקשרים שלו זמניים.',
    receives: 'שמות הצירים, ההגדרות שלהם, והאם כל ציר אוכלס בשלב 6',
    returns: 'קשרים בין צירים, איחודים וצירי ליבה',
  },
  {
    n: 9, persona: 'THE ARCHITECT', agent: 'architect', hue: 'var(--a9)', sight: 'full',
    title: 'אינטגרציה למודל מאוחד',
    about: 'כתיבת חשבון תאורטי אחד שעונה על שאלת המחקר, ולא סדרה של דיווחים ציר אחר ציר. כל פסקה בנויה בשכבות: טענה תאורטית משמות הצירים, ציטוט מילולי שמעגן אותה, וניתוח דיאלקטי של התנועה או המתח שהציטוט מראה. בסוף בדיקה רפלקטיבית: האם זה עדיין החשבון של המשתתפים, ולא השלכה של המנתח?',
    receives: 'הכול: ראיונות, צירים, שמות, נקודות אמצע, קשרים וציטוטים',
    returns: 'טקסט מסכם אחד, פסקה אחר פסקה: טענה, ציטוט, ניתוח',
  },
];

export const CHECKPOINTS = {
  A: {
    key: 'A', after: 4, title: 'נקודת עצירה א', short: 'עצירה א',
    // paper 5.3: contrasts that FAILED were often straw positions; a retained pair can still be a
    // logical opposite rather than a theoretical alternative (paper 4.3, 8)
    about: 'החוקרת קוראת אילו ניגודים שרדו ואילו נפלו, ושואלת מה הדפוס מלמד על ההנחות שלה עצמה. ניגודים שנפלו נפלו לא פעם כי לא דמיינו את החלופה ברצינות: הם היו עמדות קש. זה גם הרגע להניח בצד זוג ששרד אבל הוא בעצם היפוך לוגי.',
    target: '#checkpoint-a',
  },
  B: {
    key: 'B', after: 7, title: 'נקודת עצירה ב', short: 'עצירה ב',
    about: 'החוקרת בוחנת את אוצר המילים התאורטי מול החלופות ובוחרת שם לכל ציר.',
    target: '#checkpoint-b',
  },
};

export const STEPS = ['1', '2', '3', '4', 'A', '5', '6', '7', 'B', '8', '9'];

export const SIGHT_TEXT = {
  full: 'רואה את הראיונות',
  partial: 'רואה קטעים בלבד',
  none: 'לא רואה את הראיונות',
};

const SHORT = ['יחידות משמעות', 'תיוג', 'ניגודים', 'בדיקה בנתונים', 'צירים', 'נקודות אמצע', 'שמות לצירים', 'קשרים בין צירים', 'אינטגרציה'];
STAGES.forEach((st, i) => { st.short = SHORT[i]; });

// "Who sees what" (ARCHITECTURE 3.3): which kinds of material each stage's input carries. The method
// section derives the dots from the input each agent actually received in the recorded run
// (method.js kindsIn); SIGHT_MATRIX is the stage table, used only for a stage with no recorded call.
export const MATRIX_COLUMNS = [
  { key: 'interviews', label: 'ראיונות מלאים', short: 'ראיונות' },
  { key: 'quotes', label: 'ציטוטים מהראיונות', short: 'ציטוטים' },
  { key: 'labels', label: 'תוויות', short: 'תוויות' },
  { key: 'contrasts', label: 'ניגודים', short: 'ניגודים' },
  { key: 'names', label: 'שמות והגדרות של צירים', short: 'שמות' },
  { key: 'status', label: 'אם הציר אוכלס', short: 'אכלוס' },
];
export const SIGHT_MATRIX = {
  1: { interviews: true },
  2: { quotes: true },
  3: { labels: true },
  4: { interviews: true, quotes: true, labels: true, contrasts: true },
  5: { labels: true, contrasts: true },
  6: { interviews: true, quotes: true, labels: true, contrasts: true },
  7: { quotes: true, labels: true, contrasts: true, status: true },
  8: { names: true, status: true },
  9: { interviews: true, quotes: true, labels: true, contrasts: true, names: true, status: true },
};

export const stageByN = (n) => STAGES[Number(n) - 1];
export const isCheckpoint = (step) => step === 'A' || step === 'B';

export const RELATION_TEXT = {
  parallel: 'מקבילים',
  orthogonal: 'ניצבים',
  hierarchical: 'היררכיים',
};

export const KIND_TEXT = {
  ambivalence: 'אמביוולנטיות',
  transition: 'מעבר',
  oscillation: 'תנודה',
  partial: 'עמדה חלקית',
};
