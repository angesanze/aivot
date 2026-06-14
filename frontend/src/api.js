const BASE = "/api";
const TOKEN_KEY = "aivot_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

/* L'app registra qui cosa fare quando una chiamata risponde 401
   (tornare alla schermata di accesso): niente eventi globali su window. */
let unauthorizedHandler = () => {};
export const onUnauthorized = (handler) => {
  unauthorizedHandler = handler;
};

async function req(path, opts = {}) {
  const token = getToken();
  // Con FormData il Content-Type lo imposta il browser (boundary inclusa)
  const isForm = opts.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Token ${token}` } : {}),
      // Il backend risponde (errori, spiegazioni, email, catalogo)
      // nella lingua dell'interfaccia
      "Accept-Language": localStorage.getItem("aivot_lang") || "it",
    },
    ...opts,
  });
  if (res.status === 401) {
    // Token scaduto o revocato: si torna alla schermata di accesso
    setToken(null);
    unauthorizedHandler();
    throw new Error("Sessione scaduta: accedi di nuovo.");
  }
  if (!res.ok) {
    const text = await res.text();
    let msg = `${res.status} ${text}`;
    try {
      const j = JSON.parse(text);
      if (j.detail) msg = j.detail;
    } catch {
      /* non era JSON: tengo il testo grezzo */
    }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

const post = (path, data) =>
  req(path, { method: "POST", body: JSON.stringify(data) });
const patch = (path, data) =>
  req(path, { method: "PATCH", body: JSON.stringify(data) });
const del = (path) => req(path, { method: "DELETE" });

export const api = {
  authConfig: () => req("/auth/config/"),
  register: async (data) => {
    const u = await post("/auth/register/", data);
    setToken(u.token);
    return u;
  },
  login: async (data) => {
    const u = await post("/auth/login/", data);
    setToken(u.token);
    return u;
  },
  googleLogin: async (credential) => {
    const u = await post("/auth/google/", { credential });
    setToken(u.token);
    return u;
  },
  forgotPassword: (email) => post("/auth/forgot/", { email }),
  resetPassword: async (code, password) => {
    const u = await post("/auth/reset/", { code, password });
    setToken(u.token);
    return u;
  },
  logout: async () => {
    try {
      await post("/auth/logout/", {});
    } finally {
      setToken(null);
    }
  },
  me: () => req("/auth/me/"),
  updateMe: (data) => patch("/auth/me/", data),
  changePassword: async (data) => {
    const r = await post("/auth/password/", data);
    setToken(r.token); // le altre sessioni sono state invalidate
    return r;
  },

  templates: () => req("/templates/"),

  datasets: () => req("/datasets/"),
  createDataset: (data) => post("/datasets/", data),
  updateDataset: (id, data) => patch(`/datasets/${id}/`, data),
  deleteDataset: (id) => del(`/datasets/${id}/`),

  resources: (ds) => req(`/resources/?dataset=${ds}`),
  createResources: (list) => post("/resources/bulk/", list),
  importResources: (ds, file) => {
    const fd = new FormData();
    fd.append("dataset", ds);
    fd.append("file", file);
    return req("/resources/import/", { method: "POST", body: fd });
  },
  updateResource: (id, data) => patch(`/resources/${id}/`, data),
  deleteResource: (id) => del(`/resources/${id}/`),

  slots: (ds) => req(`/slots/?dataset=${ds}`),
  createSlot: (data) => post("/slots/", data),
  createSlots: (list) => post("/slots/bulk/", list),
  clearSlots: (ds) => post("/slots/clear/", { dataset: ds }),
  deleteSlot: (id) => del(`/slots/${id}/`),

  constraints: (ds) => req(`/constraints/?dataset=${ds}`),
  createConstraint: (data) => post("/constraints/", data),
  updateConstraint: (id, data) => patch(`/constraints/${id}/`, data),
  deleteConstraint: (id) => del(`/constraints/${id}/`),

  // La lista run è paginata lato server: si estrae la prima pagina
  runs: (ds) => req(`/runs/?dataset=${ds}`).then((d) => d.results ?? d),
  run: (id) => req(`/runs/${id}/`),

  shareRun: (id) => post(`/runs/${id}/share/`, {}),
  unshareRun: (id) => req(`/runs/${id}/share/`, { method: "DELETE" }),
  embedRun: (token) => req(`/embed/runs/${token}/`),

  storeItems: (q = "") =>
    req(`/store/${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  publishRecipe: (data) => post("/store/publish/", data),
  installRecipe: (id, ds) => post(`/store/${id}/install/`, { dataset: ds }),
  deleteRecipe: (id) => del(`/store/${id}/`),
  updateRun: (id, data) => patch(`/runs/${id}/`, data),
  deleteRun: (id) => del(`/runs/${id}/`),
  solve: (ds, timeLimit) =>
    post(`/datasets/${ds}/solve/`, { time_limit: timeLimit }),
};
