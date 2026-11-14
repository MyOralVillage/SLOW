import { BadRequestException, SetMetadata } from "@nestjs/common";

/**
 * Current SLOW licence terms (CC BY-SA 4.0). Bump this when the wording of the
 * licence block changes: every user is then asked to accept again on next login.
 * Must match the hidden `slow_terms_version` field in web/index.html.
 */
export const CURRENT_TERMS_VERSION = "SLOW-CCBYSA4-v1";

export const CREDIT_NAME_MAX_LENGTH = 200;

export const LICENCE_REQUIRED_CODE = "LICENCE_REQUIRED";

export type LicenceInput = {
  agree?: unknown;
  termsVersion?: unknown;
  creditName?: unknown;
};

/** Validates the licence fields from a form submission; throws 400 if not accepted. */
export function parseLicenceAcceptance(input: LicenceInput) {
  if (String(input.agree ?? "").trim().toLowerCase() !== "yes") {
    throw new BadRequestException("You must tick the box to agree to the SLOW licence (CC BY-SA 4.0).");
  }
  const termsVersion = String(input.termsVersion ?? "").trim();
  if (termsVersion !== CURRENT_TERMS_VERSION) {
    throw new BadRequestException("The licence terms have been updated. Please reload the page and accept the current terms.");
  }
  const creditName = String(input.creditName ?? "").trim();
  if (!creditName) {
    throw new BadRequestException("Tell us how we should credit your contributions.");
  }
  if (creditName.length > CREDIT_NAME_MAX_LENGTH) {
    throw new BadRequestException(`Credit name must be ${CREDIT_NAME_MAX_LENGTH} characters or fewer.`);
  }
  return { termsVersion, creditName };
}

export function hasAcceptedCurrentLicence(user: { licence_terms_version?: string | null }) {
  return user.licence_terms_version === CURRENT_TERMS_VERSION;
}

export const ALLOW_WITHOUT_LICENCE_KEY = "allow_without_licence";

/** Lets a write endpoint run for signed-in users who have not yet accepted the current licence. */
export const AllowWithoutLicence = () => SetMetadata(ALLOW_WITHOUT_LICENCE_KEY, true);
