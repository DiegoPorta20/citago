/**
 * Role a user holds **inside a tenant**, carried by the membership.
 *
 * A user is never "an ADMIN" globally: they are an ADMIN of one business.
 *
 * Lives in `shared/domain` because authorization is cross-cutting: every module
 * checks roles, so none of them should depend on the identity module for it.
 */
export enum UserRole {
  Owner = 'OWNER',
  Admin = 'ADMIN',
  Staff = 'STAFF',
}

export const USER_ROLES = Object.values(UserRole);
