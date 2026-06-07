export const getCurrentUserFromHeaders = (request: any) => {
  const userDataHeader = request.headers.get('x-user-data');
  return userDataHeader ? JSON.parse(userDataHeader) : null;
};

export interface CurrentUser {
  id: number;
  username: string;
  email: string;
  language?: string;
  roles: string[];
  sessionId: number;
  permissions: string[];
  profile: {
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}
