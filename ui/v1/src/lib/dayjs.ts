// src/lib/dayjs.ts
import dayjs from 'dayjs';                                // Core library  [oai_citation:1‡day.js.org](https://day.js.org/docs/en/installation/installation?utm_source=chatgpt.com)
import utcPlugin from 'dayjs/plugin/utc';                 // UTC plugin  [oai_citation:2‡day.js.org](https://day.js.org/docs/en/plugin/timezone?utm_source=chatgpt.com)
import timezonePlugin from 'dayjs/plugin/timezone';       // Timezone plugin  [oai_citation:3‡day.js.org](https://day.js.org/docs/en/plugin/timezone?utm_source=chatgpt.com)

dayjs.extend(utcPlugin);                                  // Enables dayjs.utc()
dayjs.extend(timezonePlugin);                             // Enables dayjs.tz()

// (Optional) set a default TZ for all calls to dayjs.tz()
dayjs.tz.setDefault('Europe/Berlin');                     // requires the timezone plugin  [oai_citation:4‡day.js.org](https://day.js.org/docs/en/timezone/set-default-timezone?utm_source=chatgpt.com)

export default dayjs;
