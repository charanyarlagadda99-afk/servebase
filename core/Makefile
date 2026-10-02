CXX ?= g++
CXXFLAGS ?= -std=c++17 -O3 -Wall -Wextra -Ivendor

ifeq ($(OS),Windows_NT)
    BIN_EXT := .exe
    MKDIR := if not exist bin mkdir bin
    RM := if exist bin del /Q /F bin\*
    STATIC_FLAG := -static
else
    BIN_EXT :=
    MKDIR := mkdir -p bin
    RM := rm -rf bin/*
    STATIC_FLAG :=
endif

TARGET := bin/servebase_core$(BIN_EXT)
TEST_TARGET := bin/test_runner$(BIN_EXT)

.PHONY: all clean test

all: $(TARGET)

$(TARGET): src/main.cpp
	@$(MKDIR)
	$(CXX) $(CXXFLAGS) $(STATIC_FLAG) -o $@ src/main.cpp

test: $(TEST_TARGET)
	@echo "Running ServeBase C++17 Core Engine Test Suite..."
	@./$(TEST_TARGET)

$(TEST_TARGET): tests/test_runner.cpp
	@$(MKDIR)
	$(CXX) $(CXXFLAGS) $(STATIC_FLAG) -o $@ tests/test_runner.cpp

clean:
	@$(RM)
