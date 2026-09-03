// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ChitFund {
    enum FundState { Pending, Active, Completed }

    struct FundConfig {
        address organizer;
        uint256 contribution;
        uint32 memberCount;
        string name;
    }

    struct FundSummary {
        FundConfig config;
        FundState state;
        uint32 currentRound;
        address[] members;
        address[] pastWinners;
    }

    struct MemberRecord {
        bool hasDeposited;
        bytes32 commitment;
        bytes32 reveal;
        bool hasRevealed;
    }

    uint64 public nextFundId = 1;
    mapping(uint64 => FundSummary) public funds;
    
    // fundId => round => depositCount
    mapping(uint64 => mapping(uint32 => uint32)) public depositCounts;
    mapping(uint64 => mapping(uint32 => uint32)) public commitCounts;
    mapping(uint64 => mapping(uint32 => uint32)) public revealCounts;
    
    // fundId => accumulator
    mapping(uint64 => bytes32) public accumulators;
    
    // fundId => round => member => record
    mapping(uint64 => mapping(uint32 => mapping(address => MemberRecord))) public memberRecords;

    event FundCreated(uint64 indexed fundId, address indexed organizer, string name);
    event FundJoined(uint64 indexed fundId, address indexed member);
    event FundActivated(uint64 indexed fundId);
    event Deposited(uint64 indexed fundId, uint32 round, address indexed member, uint256 amount);
    event HashCommitted(uint64 indexed fundId, uint32 round, address indexed member);
    event HashRevealed(uint64 indexed fundId, uint32 round, address indexed member);
    event PotClaimed(uint64 indexed fundId, uint32 round, address indexed winner);

    function createFund(
        string calldata _name,
        uint256 _contribution,
        uint32 _memberCount
    ) external returns (uint64) {
        require(_memberCount >= 2 && _memberCount <= 10, "Member count must be between 2 and 10");
        require(_contribution > 0, "Contribution must be > 0");

        uint64 fundId = nextFundId++;
        FundSummary storage fund = funds[fundId];
        fund.config = FundConfig({
            organizer: msg.sender,
            contribution: _contribution,
            memberCount: _memberCount,
            name: _name
        });
        fund.state = FundState.Pending;
        fund.members.push(msg.sender);

        emit FundCreated(fundId, msg.sender, _name);
        return fundId;
    }

    function joinFund(uint64 _fundId) external {
        FundSummary storage fund = funds[_fundId];
        require(fund.state == FundState.Pending, "Fund is not pending");
        require(fund.members.length < fund.config.memberCount, "Slots are full");
        
        for (uint i = 0; i < fund.members.length; i++) {
            require(fund.members[i] != msg.sender, "Already joined");
        }

        fund.members.push(msg.sender);
        emit FundJoined(_fundId, msg.sender);
    }

    function activateFund(uint64 _fundId) external {
        FundSummary storage fund = funds[_fundId];
        require(fund.config.organizer == msg.sender, "Only organizer can activate");
        require(fund.state == FundState.Pending, "Fund is not pending");
        require(fund.members.length == fund.config.memberCount, "Slots are not full");

        fund.state = FundState.Active;
        fund.currentRound = 1;
        emit FundActivated(_fundId);
    }

    function deposit(uint64 _fundId) external payable {
        FundSummary storage fund = funds[_fundId];
        require(fund.state == FundState.Active, "Fund is not active");
        require(msg.value == fund.config.contribution, "Incorrect deposit amount");
        
        bool isMember = false;
        for (uint i = 0; i < fund.members.length; i++) {
            if (fund.members[i] == msg.sender) {
                isMember = true;
                break;
            }
        }
        require(isMember, "Caller is not a member");

        uint32 round = fund.currentRound;
        MemberRecord storage record = memberRecords[_fundId][round][msg.sender];
        require(!record.hasDeposited, "Already deposited this round");

        record.hasDeposited = true;
        depositCounts[_fundId][round]++;

        emit Deposited(_fundId, round, msg.sender, msg.value);
    }

    function commitHash(uint64 _fundId, bytes32 _hash) external {
        FundSummary storage fund = funds[_fundId];
        require(fund.state == FundState.Active, "Fund is not active");

        uint32 round = fund.currentRound;
        require(depositCounts[_fundId][round] >= fund.config.memberCount, "Deposit phase not complete");

        MemberRecord storage record = memberRecords[_fundId][round][msg.sender];
        require(record.commitment == bytes32(0), "Already committed");

        record.commitment = _hash;
        commitCounts[_fundId][round]++;

        emit HashCommitted(_fundId, round, msg.sender);
    }

    function revealHash(uint64 _fundId, bytes32 _secret) external {
        FundSummary storage fund = funds[_fundId];
        require(fund.state == FundState.Active, "Fund is not active");

        uint32 round = fund.currentRound;
        MemberRecord storage record = memberRecords[_fundId][round][msg.sender];
        
        require(record.commitment != bytes32(0), "No commitment found");
        require(!record.hasRevealed, "Already revealed");

        // Verify hash
        bytes32 expectedHash = sha256(abi.encodePacked(_secret));
        require(expectedHash == record.commitment, "Hash mismatch");

        record.reveal = _secret;
        record.hasRevealed = true;

        // XOR accumulator
        accumulators[_fundId] ^= _secret;
        revealCounts[_fundId][round]++;
        
        emit HashRevealed(_fundId, round, msg.sender);

        // Select winner if all have revealed
        if (revealCounts[_fundId][round] >= fund.config.memberCount) {
            _selectWinner(_fundId);
        }
    }

    function _selectWinner(uint64 _fundId) internal {
        FundSummary storage fund = funds[_fundId];
        bytes32 accumulator = accumulators[_fundId];
        
        // Convert first 8 bytes to uint64 for randomness
        uint64 randNum = uint64(uint256(accumulator) >> 192);
        
        uint32 eligibleCount = fund.config.memberCount - uint32(fund.pastWinners.length);
        
        if (eligibleCount > 0) {
            address[] memory eligibleMembers = new address[](eligibleCount);
            uint idx = 0;
            for (uint i = 0; i < fund.members.length; i++) {
                bool alreadyWon = false;
                for (uint j = 0; j < fund.pastWinners.length; j++) {
                    if (fund.pastWinners[j] == fund.members[i]) {
                        alreadyWon = true;
                        break;
                    }
                }
                if (!alreadyWon) {
                    eligibleMembers[idx] = fund.members[i];
                    idx++;
                }
            }

            uint32 winnerIndex = uint32(randNum % eligibleCount);
            address winner = eligibleMembers[winnerIndex];
            
            fund.pastWinners.push(winner);
        }
    }

    function claimPot(uint64 _fundId) external {
        FundSummary storage fund = funds[_fundId];
        require(fund.state == FundState.Active, "Fund is not active");

        uint32 round = fund.currentRound;
        require(fund.pastWinners.length >= round, "Winner not chosen yet");

        address actualWinner = fund.pastWinners[round - 1];
        require(msg.sender == actualWinner, "Not the winner");

        uint256 pot = fund.config.contribution * fund.config.memberCount;
        
        // Native BOT transfer
        (bool success, ) = actualWinner.call{value: pot}("");
        require(success, "Transfer failed");
        
        emit PotClaimed(_fundId, round, actualWinner);

        if (round < fund.config.memberCount) {
            fund.currentRound += 1;
            accumulators[_fundId] = bytes32(0); // Reset accumulator
        } else {
            fund.state = FundState.Completed;
        }
    }
    
    // View functions for UI
    function getFundSummary(uint64 _fundId) external view returns (FundSummary memory) {
        return funds[_fundId];
    }
    
    function getRoundSummary(uint64 _fundId, uint32 _round) external view returns (uint32 deposits, uint32 commits, uint32 reveals) {
        return (
            depositCounts[_fundId][_round],
            commitCounts[_fundId][_round],
            revealCounts[_fundId][_round]
        );
    }
    
    function getMemberStatus(uint64 _fundId, uint32 _round, address _member) external view returns (bool deposited, bool committed, bool revealed) {
        MemberRecord memory record = memberRecords[_fundId][_round][_member];
        return (record.hasDeposited, record.commitment != bytes32(0), record.hasRevealed);
    }
}
