declare const utcTimestampBrand: unique symbol;
declare const workDateBrand: unique symbol;

export type UtcTimestamp = string & { readonly [utcTimestampBrand]: true };
export type WorkDate = string & { readonly [workDateBrand]: true };

