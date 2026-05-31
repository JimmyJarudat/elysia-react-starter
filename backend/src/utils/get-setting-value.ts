import prisma from '@/config/prisma.config';
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