import Combine
import Foundation
import RenderHostCore

final class ProviderStore: ObservableObject {
    @Published private(set) var snapshot = ProviderSnapshot()

    private let subscriptions: Set<String>
    private var sampler = SystemMetricsSampler()
    private var timer: Timer?

    init(subscriptions: Set<String>) {
        self.subscriptions = subscriptions
    }

    func start() {
        guard timer == nil, !subscriptions.isEmpty else { return }
        sample()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.sample()
        }
    }

    func value(for name: String) -> ProviderValue? {
        snapshot.values[name] ?? (subscriptions.contains(name) ? .loading(name: name) : nil)
    }

    deinit {
        timer?.invalidate()
    }

    private func sample() {
        snapshot = sampler.sample(subscriptions: subscriptions)
    }
}
