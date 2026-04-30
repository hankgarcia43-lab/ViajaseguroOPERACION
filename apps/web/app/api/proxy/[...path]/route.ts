import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_TARGETS = [
  'https://viajasegurooperacion-api.onrender.com/api',
  'http://localhost:4000/api'
];

const UPSTREAM_TIMEOUT_MS = Number(process.env.API_PROXY_TIMEOUT_MS ?? 15000);

function normalizeBaseUrl(raw: string) {
  return raw.trim().replace(/\/+$/, '');
}

async function resolvePathSegments(context: any): Promise<string[]> {
  const params = await context?.params;
  const value = params?.path;
  return Array.isArray(value) ? value : [];
}

function buildTargets() {
  const envTarget = process.env.API_PROXY_TARGET?.trim();
  const list = envTarget ? [envTarget, ...DEFAULT_TARGETS] : [...DEFAULT_TARGETS];
  return Array.from(new Set(list.map(normalizeBaseUrl).filter(Boolean)));
}

async function tryForward(request: NextRequest, targetBase: string, pathSuffix: string) {
  const targetUrl = `${targetBase}/${pathSuffix}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: 'follow',
      signal: controller.signal
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer();
    }

    return await fetch(targetUrl, init);
  } finally {
    clearTimeout(timeout);
  }
}

async function forward(request: NextRequest, context: any) {
  const segments = await resolvePathSegments(context);
  const incomingUrl = new URL(request.url);
  const pathSuffix = `${segments.join('/')}${incomingUrl.search}`;
  const targets = buildTargets();

  let lastError: unknown = null;

  for (const target of targets) {
    try {
      const upstream = await tryForward(request, target, pathSuffix);
      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.delete('content-encoding');
      responseHeaders.delete('content-length');
      responseHeaders.delete('transfer-encoding');

      const body = await upstream.arrayBuffer();
      return new NextResponse(body, {
        status: upstream.status,
        headers: responseHeaders
      });
    } catch (error) {
      lastError = error;
    }
  }

  return NextResponse.json(
    {
      message: 'No fue posible conectar con la API de respaldo desde el proxy.',
      detail: lastError instanceof Error ? lastError.message : String(lastError)
    },
    { status: 502 }
  );
}

export async function GET(request: NextRequest, context: any) {
  return forward(request, context);
}

export async function POST(request: NextRequest, context: any) {
  return forward(request, context);
}

export async function PUT(request: NextRequest, context: any) {
  return forward(request, context);
}

export async function PATCH(request: NextRequest, context: any) {
  return forward(request, context);
}

export async function DELETE(request: NextRequest, context: any) {
  return forward(request, context);
}