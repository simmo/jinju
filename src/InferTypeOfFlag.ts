export type InferTypeOfFlag<T> = T extends { parse: (...args: any[]) => infer R } ? R : never;
