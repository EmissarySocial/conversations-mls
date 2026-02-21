/** @public */
export const defaultExtensionTypes = {
    application_id: 1,
    ratchet_tree: 2,
    required_capabilities: 3,
    external_pub: 4,
    external_senders: 5,
};
export function isDefaultExtensionTypeValue(v) {
    return Object.values(defaultExtensionTypes).includes(v);
}
//# sourceMappingURL=defaultExtensionType.js.map