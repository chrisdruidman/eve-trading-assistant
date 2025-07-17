// Test file to trigger the Agent Hook
export interface TestInterface {
  id: string;
  name: string;
  createdAt: Date;
}

export class TestService {
  constructor() {
    console.log('TestService initialized - testing hook functionality');
  }

  public testMethod(): string {
    return 'Hook test successful';
  }
}
