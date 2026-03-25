import { createHash } from "crypto";

function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(data).digest());
}

function _h(x: number, param: number, c: number, asInt: boolean): number {
  const f = (x * (c - param)) / 255.0 + param;
  if (asInt) return Math.floor(f);
  const rounded = Math.round(f * 100) / 100;
  if (rounded === 0.0) return 0.0;
  return rounded;
}

function cubicBezierEased(
  t: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  function bezier(u: number): [number, number] {
    const omu = 1.0 - u;
    const b1 = 3.0 * omu * omu * u;
    const b2 = 3.0 * omu * u * u;
    const b3 = u * u * u;
    const x = b1 * x1 + b2 * x2 + b3;
    const y = b1 * y1 + b2 * y2 + b3;
    return [x, y];
  }

  let lo = 0.0;
  let hi = 1.0;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (bezier(mid)[0] < t) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const u = 0.5 * (lo + hi);
  return bezier(u)[1];
}

function xa(svg: string): number[][] {
  const substr = svg.substring(9);
  const parts = substr.split("C");
  const out: number[][] = [];
  for (const part of parts) {
    const cleaned = part.replace(/[^\d]+/g, " ").trim();
    if (cleaned === "") {
      out.push([0]);
    } else {
      const nums = cleaned
        .split(/\s+/)
        .filter((t) => t !== "")
        .map((t) => parseInt(t, 10));
      out.push(nums);
    }
  }
  return out;
}

function tohex(num: number): string {
  const rounded = Math.round(num * 100) / 100;
  if (rounded === 0.0) return "0";
  const sign = rounded < 0 ? "-" : "";
  const absval = Math.abs(rounded);
  const intpart = Math.floor(absval);
  let frac = absval - intpart;
  if (frac === 0.0) return sign + intpart.toString(16);
  const fracDigits: string[] = [];
  for (let i = 0; i < 20; i++) {
    frac *= 16;
    const digit = Math.floor(frac + 1e-12);
    fracDigits.push(digit.toString(16));
    frac -= digit;
    if (Math.abs(frac) < 1e-12) break;
  }
  let fracStr = fracDigits.join("").replace(/0+$/, "");
  if (fracStr === "") return sign + intpart.toString(16);
  return sign + intpart.toString(16) + "." + fracStr;
}

function simulateStyle(
  values: number[],
  c: number
): { color: string; transform: string } {
  const duration = 4096;
  const currentTime = Math.round(c / 10.0) * 10;
  const t = currentTime / duration;

  const cp: number[] = [];
  for (let i = 0; i < values.length - 7; i++) {
    cp.push(_h(values[7 + i], i % 2 === 0 ? 0 : -1, 1, false));
  }

  const easedY = cubicBezierEased(t, cp[0], cp[1], cp[2], cp[3]);

  const start = values.slice(0, 3).map(Number);
  const end = values.slice(3, 6).map(Number);
  const r = Math.round(start[0] + (end[0] - start[0]) * easedY);
  const g = Math.round(start[1] + (end[1] - start[1]) * easedY);
  const b = Math.round(start[2] + (end[2] - start[2]) * easedY);
  const color = `rgb(${r}, ${g}, ${b})`;

  const endAngle = _h(values[6], 60, 360, true);
  const angle = endAngle * easedY;
  const rad = (angle * Math.PI) / 180.0;

  function isEffectivelyZero(val: number): boolean {
    return Math.abs(val) < 1e-7;
  }
  function isEffectivelyInteger(val: number): boolean {
    return Math.abs(val - Math.round(val)) < 1e-7;
  }

  const cosv = Math.cos(rad);
  const sinv = Math.sin(rad);

  let a: string | number;
  let d: string | number;
  if (isEffectivelyZero(cosv)) {
    a = 0;
    d = 0;
  } else if (isEffectivelyInteger(cosv)) {
    a = Math.round(cosv);
    d = Math.round(cosv);
  } else {
    a = cosv.toFixed(6);
    d = cosv.toFixed(6);
  }

  let bval: string | number;
  let cval: string | number;
  if (isEffectivelyZero(sinv)) {
    bval = 0;
    cval = 0;
  } else if (isEffectivelyInteger(sinv)) {
    bval = Math.round(sinv);
    cval = Math.round(-sinv);
  } else {
    bval = sinv.toFixed(7);
    cval = (-sinv).toFixed(7);
  }

  const transform = `matrix(${a}, ${bval}, ${cval}, ${d}, 0, 0)`;
  return { color, transform };
}

function xs(xBytes: Uint8Array, svg: string, xValues: number[]): string {
  const arr = Array.from(xBytes);
  const idx = arr[xValues[0]] % 16;
  const c =
    (arr[xValues[1]] % 16) * (arr[xValues[2]] % 16) * (arr[xValues[3]] % 16);
  const o = xa(svg);
  const vals = o[idx];
  const k = simulateStyle(vals, c);

  const concat = k.color + k.transform;
  const matches = concat.match(/[\d.\-]+/g) || [];
  const converted: string[] = [];
  for (const m of matches) {
    const num = parseFloat(m);
    converted.push(tohex(num));
  }
  const joined = converted.join("");
  return joined.replace(/\./g, "").replace(/-/g, "");
}

export function generateSign(
  path: string,
  method: string,
  verification: string,
  svg: string,
  xValues: number[],
  timeN?: number,
  randomFloat?: number
): string {
  const n = timeN ?? Math.floor(Date.now() / 1000 - 1682924400);
  const t = new Uint8Array(4);
  const view = new DataView(t.buffer);
  view.setUint32(0, n, true);

  const r = Buffer.from(verification, "base64");
  const o = xs(new Uint8Array(r), svg, xValues);

  const msg = [method, path, String(n)].join("!") + "obfiowerehiring" + o;
  const digest = sha256(new TextEncoder().encode(msg)).slice(0, 16);

  const prefixByte = Math.floor(
    (randomFloat ?? Math.random()) * 256
  );
  const rBytes = new Uint8Array(r);
  const arr = new Uint8Array(1 + rBytes.length + t.length + digest.length + 1);
  arr[0] = prefixByte;
  arr.set(rBytes, 1);
  arr.set(t, 1 + rBytes.length);
  arr.set(digest, 1 + rBytes.length + t.length);
  arr[arr.length - 1] = 3;
  if (arr.length > 0) {
    const first = arr[0];
    for (let i = 1; i < arr.length; i++) {
      arr[i] = arr[i] ^ first;
    }
  }

  return Buffer.from(arr)
    .toString("base64")
    .replace(/=/g, "");
}
