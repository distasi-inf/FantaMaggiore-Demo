// FIX: Tutti i servizi Angular importavano environment.development invece di environment.
// In produzione Angular usa questo file. Se importi .development hardcoded,
// il build di produzione punterà sempre a localhost:8080.

export const environment = {
  production: true,
  apiUrl: 'https://fantamaggiore-live-api.onrender.com/api',

  // ⬇️ AGGIUNGI LE TUE CREDENZIALI SUPABASE
  // Le trovi su: Supabase Dashboard → Project Settings → API
  supabaseUrl: 'https://oljmmwdiuebilrnevxai.supabase.co',   // <-- Project URL
  supabaseAnonKey: 'sb_publishable_OckqXIm9eOKwm8erQmilOw_REJCxOAA',                              // <-- anon public key
};
