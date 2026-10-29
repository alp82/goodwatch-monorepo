// useSignOut keeps the member's handle here for the signed-out page (SignedOutTv), which reads it once and forgets
// it. Its own module, so the account menu doesn't load the room's code with it.
export const SIGNED_OUT_NAME_KEY = "gw_signed_out_name"
