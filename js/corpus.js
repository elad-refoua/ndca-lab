// The corpus section: research question, description and the interviews of the run on screen.
import { $, clear } from './util.js';
import { renderInterview } from './reader.js';

export function initCorpus(app) {
  const render = () => {
    const c = app.model.corpus || {};
    const custom = app.live && app.live.kind === 'custom';
    $('#corpus-invented').textContent = custom
      ? (app.health && app.health.remote
        ? (app.health.storage === 'memory'
          ? 'אלה הטקסטים שהכנסתם בחלק "החומרים שלכם". הם מוצגים רק בדפדפן הזה, והשרת מחזיק אותם רק בזיכרון עד שתמחקו אותם או עד שיפוג תוקפם.'
          : 'אלה הטקסטים שהכנסתם בחלק "החומרים שלכם". הם מוצגים רק בדפדפן הזה ובשרת.')
        : 'אלה הראיונות שהכנסתם בחלק "החומרים שלכם". הם מוצגים רק בדפדפן הזה ובשרת המקומי שלכם.')
      : (c.invented
        ? 'ראיונות בדויים, שנכתבו להדגמה בלבד'
        : 'שימו לב: הקורפוס הזה אינו מסומן כבדוי.');
    $('#corpus-description').textContent = custom ? '' : (c.description || '');
    $('#corpus-rq').textContent = c.research_question || '';
    const docs = clear($('#corpus-docs'));
    app.model.interviews.forEach((itv) => docs.append(renderInterview(itv, { headingTag: 'h3', clamp: true })));
  };
  render();
  app.on('model', render);
}
