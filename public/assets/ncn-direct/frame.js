// These are trusted, passive print documents in a same-origin sandbox.
// Replace their contents in place: srcdoc navigation adds child history entries
// and can consume Safari's Back action before the catalogue sees popstate.
const documents=new WeakMap();
export const frameHTML=frame=>documents.get(frame)||frame.srcdoc||'';
export function writeFrame(frame,html){
  const child=frame.contentDocument;
  if(!child)throw new Error('Chưa mở được khung mẫu. Anh tải lại trang rồi thử nhé.');
  documents.set(frame,html);
  child.open();child.write(html);child.close();
  child.documentElement?.getBoundingClientRect();
  return child;
}
