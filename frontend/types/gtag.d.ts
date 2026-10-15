type GtagFn = {
  (command: "js", value: Date): void;
  (command: "config", id: string, params?: Record<string, unknown>): void;
  (command: "event", name: string, params?: Record<string, unknown>): void;
};

interface Window {
  dataLayer?: unknown[];
  gtag?: GtagFn;
}
