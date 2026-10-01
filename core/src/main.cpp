#include <iostream>
#include <string>
#include "dispatcher.hpp"

int main() {
    // High-performance I/O sync disable
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;

        try {
            json req = json::parse(line);
            servebase::WorkerResponse resp = servebase::dispatch(req);
            std::cout << resp.to_json().dump() << "\n";
            std::cout.flush();
        } catch (const std::exception& ex) {
            json err_resp{
                {"id", "unknown"},
                {"ok", false},
                {"error", std::string("Malformed JSON line: ") + ex.what()}
            };
            std::cout << err_resp.dump() << "\n";
            std::cout.flush();
        }
    }

    return 0;
}
