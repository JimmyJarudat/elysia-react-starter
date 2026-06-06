import { Elysia, t } from "elysia";
import { ProfileService } from "@/modules/profile/profile.service";
import { getCurrentUserFromHeaders } from "@/utils/get-current-user";

export const profileController = new Elysia({ prefix: "/profile" })
  .get("/me", async ({ request, set }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user?.id) {
      set.status = 401;
      return { success: false, message: "Authentication required" };
    }

    const result = await ProfileService.getMyProfile(user.id);
    if (!result.success && "status" in result) set.status = result.status;
    return result;
  })
  .put("/me", async ({ request, body, set }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user?.id) {
      set.status = 401;
      return { success: false, message: "Authentication required" };
    }

    const result = await ProfileService.updateMyProfile(user.id, {
      ...body,
      removeAvatar: body.removeAvatar === true || body.removeAvatar === "true",
    });
    if (!result.success && "status" in result) set.status = result.status;
    return result;
  }, {
    body: t.Object({
      firstName: t.Optional(t.String()),
      lastName: t.Optional(t.String()),
      displayName: t.Optional(t.String()),
      phoneNumber: t.Optional(t.String()),
      department: t.Optional(t.String()),
      address: t.Optional(t.String()),
      subDistrict: t.Optional(t.String()),
      city: t.Optional(t.String()),
      state: t.Optional(t.String()),
      postalCode: t.Optional(t.String()),
      country: t.Optional(t.String()),
      dateOfBirth: t.Optional(t.String()),
      gender: t.Optional(t.String()),
      bio: t.Optional(t.String()),
      website: t.Optional(t.String()),
      avatar: t.Optional(t.File()),
      removeAvatar: t.Optional(t.Union([t.Boolean(), t.Literal("true"), t.Literal("false")])),
    }),
  });
