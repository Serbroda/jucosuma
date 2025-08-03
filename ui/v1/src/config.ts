const {VITE_BACKEND_BASE_URL} = import.meta.env;

const apiBasePath: string = VITE_BACKEND_BASE_URL || "/api";

export {apiBasePath};
