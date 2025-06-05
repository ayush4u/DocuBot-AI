class AuthService {
  private static readonly TOKEN_KEY = 'auth_token';

  static setToken(token: string): void {
    console.log('AuthService - Setting token, length:', token.length);
    console.log('AuthService - Token starts with:', token.substring(0, 50) + '...');
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static getToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    console.log('AuthService - Retrieved token, length:', token ? token.length : 0);
    if (token) {
      console.log('AuthService - Token starts with:', token.substring(0, 50) + '...');
    }
    return token;
  }

  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static getAuthHeaders(): { Authorization: string } | Record<string, never> {
    const token = this.getToken();
    if (!token) return {};

    const headers = { Authorization: `Bearer ${token}` };
    console.log('AuthService - Auth headers Authorization length:', headers.Authorization.length);
    console.log('AuthService - Auth headers Authorization starts with:', headers.Authorization.substring(0, 60) + '...');
    return headers;
  }

  static getUser(): { id: string; email: string } | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('AuthService - getUser decoded successfully:', payload.email);
      return { id: payload.id, email: payload.email };
    } catch (error) {
      console.error('AuthService - getUser decode error:', error);
      console.log('AuthService - Token that failed in getUser:', token.substring(0, 100) + '...');
      return null;
    }
  }

  static isAuthenticated(): boolean {
    return this.getToken() !== null;
  }
}

export default AuthService;