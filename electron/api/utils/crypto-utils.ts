import sjcl from "sjcl";

export const doPbkdf2NotCoded = (passwd: string, saltLocal: string): string => {
  const derivedKey = sjcl.misc.pbkdf2(passwd, saltLocal, 1000, 128);
  const hexdevkey = sjcl.codec.hex.fromBits(derivedKey);
  return hexdevkey;
}
