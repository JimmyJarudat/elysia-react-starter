import prisma from '@/config/prisma.config';
import { decryptText } from '@/utils/encryption';

export const getSettingValue = async (
    settingId: string,
    defaultValue: number | boolean | string,
    userId?: number | string
): Promise<any> => {
    const setting = await prisma.system_config.findFirst({
        where: {
            id: settingId,
            is_active: true
        }
    });

    if (!setting) {
        return defaultValue;
    }

    // แปลงค่าตามประเภทข้อมูล
    switch (setting.data_type) {
        case 'NUMBER':
            const numValue = parseInt(setting.value, 10);
            return isNaN(numValue) ? defaultValue : numValue;
        case 'BOOLEAN':
            return setting.value.toLowerCase() === 'true';
        case 'JSON':
            try {
                return JSON.parse(setting.value);
            } catch (e) {
                console.error(`Error parsing JSON setting value for ${settingId}:`, e);
                return defaultValue;
            }
        default:
            return setting.value;
    }
};

export const getSecretSettingValue = async (settingId: string): Promise<string> => {
    const setting = await prisma.system_config.findFirst({
        where: {
            id: settingId,
            is_active: true
        },
        select: {
            value: true,
            is_encrypted: true,
        },
    });

    if (!setting?.value) {
        return '';
    }

    if (!setting.is_encrypted) {
        return setting.value;
    }

    try {
        return decryptText(setting.value);
    } catch {
        return '';
    }
};

export const upsertSettingValue = async (
    id: string,
    value: string,
    displayName: string,
    description: string,
    category: string,
    dataTypeOrUserId: 'STRING' | 'NUMBER' | 'BOOLEAN' | number | undefined = 'STRING',
    isEncryptedOrUserId: boolean | number = false,
    userId?: number,
) => {
    const dataType = typeof dataTypeOrUserId === 'string' ? dataTypeOrUserId : 'STRING';
    const isEncrypted = typeof isEncryptedOrUserId === 'boolean' ? isEncryptedOrUserId : false;
    const resolvedUserId = typeof dataTypeOrUserId === 'number'
        ? dataTypeOrUserId
        : typeof isEncryptedOrUserId === 'number'
            ? isEncryptedOrUserId
            : userId;
    const modifiedByData = resolvedUserId && resolvedUserId > 0
        ? { last_modified_by_id: resolvedUserId }
        : {};

    await prisma.system_config.upsert({
        where: { id },
        update: {
            value,
            display_name: displayName,
            description,
            category,
            data_type: dataType,
            is_active: true,
            is_encrypted: isEncrypted,
            ...modifiedByData,
            updated_at: new Date(),
        },
        create: {
            id,
            value,
            display_name: displayName,
            description,
            category,
            data_type: dataType,
            is_active: true,
            is_encrypted: isEncrypted,
            ...modifiedByData,
        },
    });
};
