import { CHAIN_PARAM, isValidChain, parseChainParam } from "@/lib/chain-query";
import { chainCookie } from "@/lib/chains";
import type { ChainId } from "@/lib/types";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function resolveChain(param: string | null, cookie: string | undefined): ChainId {
  if (isValidChain(param)) return param;
  if (isValidChain(cookie)) return cookie;
  return "polkadot";
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const param = searchParams.get(CHAIN_PARAM);
  const cookie = request.cookies.get(chainCookie)?.value;
  const chain = resolveChain(param, cookie);

  if (param !== chain) {
    const url = request.nextUrl.clone();
    url.searchParams.set(CHAIN_PARAM, chain);
    const response = NextResponse.redirect(url);
    response.cookies.set(chainCookie, chain, { path: "/", maxAge: 31536000, sameSite: "lax" });
    return response;
  }

  const response = NextResponse.next();
  response.cookies.set(chainCookie, chain, { path: "/", maxAge: 31536000, sameSite: "lax" });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
