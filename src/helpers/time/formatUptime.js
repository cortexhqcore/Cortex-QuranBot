// time labels for en/ar
const labels = {
    en: {
        seconds: 'Seconds',
        minutes: 'Minutes',
        hours: 'Hours',
        days: 'Days',
        months: 'Months',
        years: 'Years',
    },
    ar: {
        seconds: 'ثوانٍ',
        minutes: 'دقائق',
        hours: 'ساعات',
        days: 'أيام',
        months: 'شهور',
        years: 'سنين',
    },
};

// Converts milliseconds to a human-readable duration string in the specified language
function formatTimeDuration(ms, lang = 'en') {
    const t = labels[lang] || labels.en;
    // convert to seconds first
    let secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs} ${t.seconds}`;
    // to minutes
    let mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} ${t.minutes}`;
    // to hours
    let hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ${t.hours}`;
    // to days (approx 30 days/month)
    let days = Math.floor(hrs / 24);
    if (days < 30) return `${days} ${t.days}`;
    // to months
    let months = Math.floor(days / 30);
    if (months < 12) return `${months} ${t.months}`;
    // to years
    let years = Math.floor(months / 12);
    return `${years} ${t.years}`;
}

module.exports = formatTimeDuration;
