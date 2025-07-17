export const userSchemas = {
  getProfile: {
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              username: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              preferences: {
                type: 'object',
                properties: {
                  theme: { type: 'string', enum: ['light', 'dark'] },
                  notifications: {
                    type: 'object',
                    properties: {
                      email: { type: 'boolean' },
                      inApp: { type: 'boolean' },
                      push: { type: 'boolean' },
                    },
                  },
                  trading: {
                    type: 'object',
                    properties: {
                      riskTolerance: {
                        type: 'string',
                        enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'],
                      },
                      defaultBudget: { type: 'number' },
                      preferredRegions: { type: 'array', items: { type: 'number' } },
                    },
                  },
                },
              },
              subscription: {
                type: 'object',
                properties: {
                  tier: { type: 'string', enum: ['FREE', 'PREMIUM'] },
                  expiresAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
  },

  updateProfile: {
    body: {
      type: 'object',
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 50 },
        email: { type: 'string', format: 'email' },
      },
      additionalProperties: false,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { $ref: '#/definitions/UserProfile' },
          message: { type: 'string' },
        },
      },
    },
  },

  getPreferences: {
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              theme: { type: 'string', enum: ['light', 'dark'] },
              notifications: {
                type: 'object',
                properties: {
                  email: { type: 'boolean' },
                  inApp: { type: 'boolean' },
                  push: { type: 'boolean' },
                },
              },
              trading: {
                type: 'object',
                properties: {
                  riskTolerance: {
                    type: 'string',
                    enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'],
                  },
                  defaultBudget: { type: 'number' },
                  preferredRegions: { type: 'array', items: { type: 'number' } },
                },
              },
            },
          },
        },
      },
    },
  },

  updatePreferences: {
    body: {
      type: 'object',
      properties: {
        theme: { type: 'string', enum: ['light', 'dark'] },
        notifications: {
          type: 'object',
          properties: {
            email: { type: 'boolean' },
            inApp: { type: 'boolean' },
            push: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        trading: {
          type: 'object',
          properties: {
            riskTolerance: { type: 'string', enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'] },
            defaultBudget: { type: 'number', minimum: 0 },
            preferredRegions: { type: 'array', items: { type: 'number' } },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { $ref: '#/definitions/UserPreferences' },
          message: { type: 'string' },
        },
      },
    },
  },

  updateNotificationPreferences: {
    body: {
      type: 'object',
      properties: {
        email: { type: 'boolean' },
        inApp: { type: 'boolean' },
        push: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              email: { type: 'boolean' },
              inApp: { type: 'boolean' },
              push: { type: 'boolean' },
            },
          },
          message: { type: 'string' },
        },
      },
    },
  },

  updateTradingPreferences: {
    body: {
      type: 'object',
      properties: {
        riskTolerance: { type: 'string', enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'] },
        defaultBudget: { type: 'number', minimum: 0 },
        preferredRegions: { type: 'array', items: { type: 'number' } },
      },
      additionalProperties: false,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              riskTolerance: { type: 'string', enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'] },
              defaultBudget: { type: 'number' },
              preferredRegions: { type: 'array', items: { type: 'number' } },
            },
          },
          message: { type: 'string' },
        },
      },
    },
  },

  updateTheme: {
    body: {
      type: 'object',
      properties: {
        theme: { type: 'string', enum: ['light', 'dark'] },
      },
      required: ['theme'],
      additionalProperties: false,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              theme: { type: 'string', enum: ['light', 'dark'] },
            },
          },
          message: { type: 'string' },
        },
      },
    },
  },

  deleteAccount: {
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              scheduledFor: { type: 'string', format: 'date-time' },
            },
          },
          message: { type: 'string' },
        },
      },
    },
  },

  exportData: {
    response: {
      200: {
        type: 'object',
        properties: {
          profile: { type: 'object' },
          preferences: { type: 'object' },
          eveCharacters: { type: 'array' },
          tradingPlans: { type: 'array' },
          watchlists: { type: 'array' },
          exportedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },

  checkEmail: {
    body: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
      },
      required: ['email'],
      additionalProperties: false,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              available: { type: 'boolean' },
            },
          },
        },
      },
    },
  },

  checkUsername: {
    body: {
      type: 'object',
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 50 },
      },
      required: ['username'],
      additionalProperties: false,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              available: { type: 'boolean' },
            },
          },
        },
      },
    },
  },

  changePassword: {
    body: {
      type: 'object',
      properties: {
        currentPassword: { type: 'string', minLength: 8 },
        newPassword: { type: 'string', minLength: 8 },
      },
      required: ['currentPassword', 'newPassword'],
      additionalProperties: false,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
        },
      },
    },
  },

  getUserStats: {
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              profileCompleteness: { type: 'number' },
              lastLoginAt: { type: 'string', format: 'date-time' },
              accountAge: { type: 'number' },
              preferencesSet: { type: 'boolean' },
            },
          },
        },
      },
    },
  },

  deactivateAccount: {
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
        },
      },
    },
  },

  reactivateAccount: {
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
        },
      },
    },
  },

  validateUser: {
    params: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
      },
      required: ['userId'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              exists: { type: 'boolean' },
            },
          },
        },
      },
    },
  },
};
