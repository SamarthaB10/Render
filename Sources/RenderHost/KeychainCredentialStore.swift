import Foundation
import Security

struct OAuthCredential: Codable {
    let accessToken: String
    let refreshToken: String?
    let expiresAt: Date

    var isExpired: Bool {
        expiresAt <= Date().addingTimeInterval(30)
    }
}

protocol CredentialStore {
    func load(connector: String) throws -> OAuthCredential?
    func save(_ credential: OAuthCredential, connector: String) throws
    func remove(connector: String) throws
}

final class KeychainCredentialStore: CredentialStore {
    private let service = "com.samarthab.Render.credentials"

    func load(connector: String) throws -> OAuthCredential? {
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query(for: connector, returnData: true) as CFDictionary, &item)
        guard status != errSecItemNotFound else { return nil }
        guard status == errSecSuccess, let data = item as? Data else {
            throw KeychainCredentialStoreError.status(status)
        }
        return try JSONDecoder().decode(OAuthCredential.self, from: data)
    }

    func save(_ credential: OAuthCredential, connector: String) throws {
        let data = try JSONEncoder().encode(credential)
        let query = query(for: connector, returnData: false)
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainCredentialStoreError.status(status)
        }
    }

    func remove(connector: String) throws {
        let status = SecItemDelete(query(for: connector, returnData: false) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainCredentialStoreError.status(status)
        }
    }

    private func query(for connector: String, returnData: Bool) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword as String,
            kSecAttrService as String: service,
            kSecAttrAccount as String: connector,
            kSecMatchLimit as String: kSecMatchLimitOne as String
        ]
        if returnData {
            query[kSecReturnData as String] = true
        }
        return query
    }
}

enum KeychainCredentialStoreError: LocalizedError {
    case status(OSStatus)

    var errorDescription: String? {
        switch self {
        case .status(let status):
            return "credential storage failed with Keychain status \(status)"
        }
    }
}
