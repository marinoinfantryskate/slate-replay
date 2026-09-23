export const DESIGN_STORAGE_KEY = "sr_design";

/** Runs before first paint (inlined in <head>) so the saved design doesn't flash. */
export const DESIGN_BOOT_SCRIPT = `try{var d=localStorage.getItem("${DESIGN_STORAGE_KEY}");if(d)document.documentElement.dataset.design=d}catch(e){}`;
