import React, { createContext, useContext, useState } from "react";
import it from "./locales/it.json";
import en from "./locales/en.json";

/* i18n minimale e senza dipendenze: dizionari piatti, interpolazione
   {var}, fallback italiano -> chiave. La lingua scelta persiste in
   localStorage e parte dal browser al primo accesso. */

const DICTS = { it, en };

export const LANGS = [
  { code: "it", label: "Italiano" },
  { code: "en", label: "English" },
];

const STORAGE_KEY = "aivot_lang";

export const getLang = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && DICTS[saved]) return saved;
  return (navigator.language || "").toLowerCase().startsWith("it")
    ? "it"
    : "en";
};

const translate = (lang, key, vars) => {
  let s = DICTS[lang]?.[key] ?? DICTS.it[key] ?? key;
  if (vars)
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
};

const I18nCtx = createContext({
  lang: "it",
  t: (key, vars) => translate("it", key, vars),
  setLang: () => {},
});

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(getLang);
  const value = {
    lang,
    t: (key, vars) => translate(lang, key, vars),
    setLang: (l) => {
      localStorage.setItem(STORAGE_KEY, l);
      setLangState(l);
    },
  };
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
export const useT = () => useContext(I18nCtx).t;

/* Locale per i formati data: dipende dalla lingua dell'interfaccia. */
export const useLocale = () => {
  const { lang } = useContext(I18nCtx);
  return lang === "it" ? "it-IT" : "en-GB";
};
