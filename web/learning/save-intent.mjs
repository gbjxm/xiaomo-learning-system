// Saving instructions belong to the current request, not quoted source text,
// fenced examples or earlier turns. Web, CLI and the committer share this rule.
export function requestIntentText(message) {
  return String(message ?? '').replace(/```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)/g, ' ').replace(/^\s*>.*$/gm, ' ').replace(/“[^”]*”|‘[^’]*’|「[^」]*」|『[^』]*』|"[^"\n]*"|'[^'\n]*'/g, ' ');
}
export function hasNoSaveIntent(payload) {
  if (payload?.skipSave === true) return true;
  const message = requestIntentText(payload?.message).trim();
  if (/^(?:如果|假如|假设|要是|例如|比如|举个例子)/.test(message)) return false;
  return /(?:不要|不用|不必|无需)保存|(?:别|不要|不必|不用)记(?:录)?|只聊(?:聊)?(?:不记|不存)|先不(?:保存|记录)/.test(message);
}
