export interface User {
    id: number;
    name: string;
    email: string;
    role?: string;
    email_verified_at?: string;
}

export interface AuthPermissions {
    accessPos: boolean;
    accessOverview: boolean;
    accessReports: boolean;
    accessProducts: boolean;
    accessCustomers: boolean;
    accessCash: boolean;
    manageCash: boolean;
    manageSettings: boolean;
    manageUsers: boolean;
    useSupervisorPin: boolean;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User;
        permissions: AuthPermissions;
    };
    money: {
        currency: string;
        exchangeRateUsdCrc: number;
    };
};
