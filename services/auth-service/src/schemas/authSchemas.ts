export const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'username'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address',
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 128,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]',
        description:
          'Password must contain at least 8 characters with uppercase, lowercase, number and special character',
      },
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 30,
        pattern: '^[a-zA-Z0-9_-]+$',
        description: 'Username can only contain letters, numbers, underscores and hyphens',
      },
    },
    additionalProperties: false,
  },
};

export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
      },
      password: {
        type: 'string',
        minLength: 1,
      },
    },
    additionalProperties: false,
  },
};

export const refreshTokenSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: {
        type: 'string',
        minLength: 1,
      },
    },
    additionalProperties: false,
  },
};

export const authResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
        tokenType: { type: 'string', enum: ['Bearer'] },
      },
      required: ['accessToken', 'refreshToken', 'expiresAt', 'tokenType'],
    },
    message: { type: 'string' },
  },
  required: ['data', 'message'],
};

export const userResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'email', 'username', 'createdAt'],
        },
        tokens: authResponseSchema.properties.data,
      },
      required: ['user', 'tokens'],
    },
    message: { type: 'string' },
  },
  required: ['data', 'message'],
};

export const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' },
    details: { type: 'object' },
  },
  required: ['error'],
};
