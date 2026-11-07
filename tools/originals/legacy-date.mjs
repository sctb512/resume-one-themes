// The two pinned SSR themes use en-US month/year labels from @jsonresume/core.
// QuickJS has Date but no ECMA-402. Implement the specific formats these
// upstream renderers request, including UTC handling for date-only values.
const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

globalThis.Intl ??= {};
Intl.DateTimeFormat ??= class {
  constructor(locale, { month, year, timeZone, numberingSystem }) {
    if (!/^en(?:-US)?$/i.test(locale) || year !== "numeric"
      || !["short", "long", "2-digit"].includes(month)
      || (timeZone && timeZone !== "UTC") || (numberingSystem && numberingSystem !== "latn")) {
      throw new RangeError("Unsupported upstream month/year format");
    }
    this.month = month;
    this.utc = timeZone === "UTC";
  }

  format(date) {
    const month = this.utc ? date.getUTCMonth() : date.getMonth();
    const year = this.utc ? date.getUTCFullYear() : date.getFullYear();
    if (this.month === "2-digit") return `${String(month + 1).padStart(2, "0")}/${year}`;
    return `${this.month === "short" ? months[month].slice(0, 3) : months[month]} ${year}`;
  }
};
