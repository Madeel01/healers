import apiClient from "../api/apiClient";

// This module is the single source of truth for service categories in the app.
// Components can subscribe to it so a create, update, or delete is reflected
// anywhere services are being displayed.
let services = [];
let hasLoaded = false;
let pendingRequest = null;
const subscribers = new Set();

const visibleServices = (includeInactive = false) =>
  includeInactive ? services : services.filter((service) => service.isActive);

const notify = () => {
  const snapshot = [...services];
  subscribers.forEach((subscriber) => subscriber(snapshot));
};

export const getCachedServices = ({ includeInactive = false } = {}) =>
  visibleServices(includeInactive);

export const fetchServices = async ({ force = false, includeInactive = false } = {}) => {
  if (hasLoaded && !force) {
    return visibleServices(includeInactive);
  }

  if (!pendingRequest) {
    pendingRequest = apiClient
      .get("/admin/services", { params: { includeInactive: true } })
      .then((response) => {
        const result = response.data;
        if (!result?.success) {
          throw new Error(result?.message || "Failed to fetch services.");
        }

        services = result.data || [];
        hasLoaded = true;
        notify();
        return services;
      })
      .finally(() => {
        pendingRequest = null;
      });
  }

  await pendingRequest;
  return visibleServices(includeInactive);
};

export const searchServices = async (query = "", options = {}) => {
  const list = await fetchServices(options);
  const term = String(query).trim().toLowerCase();

  return term
    ? list.filter((service) => service.label.toLowerCase().includes(term))
    : list;
};

export const subscribeToServices = (subscriber, { includeInactive = false } = {}) => {
  const listener = (allServices) => {
    subscriber(
      includeInactive
        ? allServices
        : allServices.filter((service) => service.isActive),
    );
  };

  subscribers.add(listener);
  listener(services);
  return () => subscribers.delete(listener);
};

export const upsertCachedService = (service) => {
  if (!service?.id) return;

  const index = services.findIndex((item) => item.id === service.id);
  services = index === -1
    ? [...services, service]
    : services.map((item) => (item.id === service.id ? service : item));
  hasLoaded = true;
  notify();
};

export const removeCachedService = (serviceId) => {
  services = services.filter((service) => service.id !== serviceId);
  hasLoaded = true;
  notify();
};
