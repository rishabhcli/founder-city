import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodIssue, type ZodSchema } from "zod";

type ValidationError = {
  code: string;
  message: string;
  issues: ZodIssue[];
};

export type ParsedBody<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function mapParseError(error: ZodError<unknown>): ValidationError {
  return {
    code: "invalid_payload",
    message: "The request payload did not match the expected format.",
    issues: error.issues,
  };
}

export async function parseRequestBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): Promise<ParsedBody<T>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Malformed JSON body." },
        { status: 400 },
      ),
    };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const error = mapParseError(parsed.error);
    return {
      ok: false,
      response: NextResponse.json(error, { status: 400 }),
    };
  }

  return { ok: true, data: parsed.data };
}
