pragma solidity >0.5.0;

import "./ElectionToken.sol";

contract Election {
    ElectionToken public tokenContract;

    // Model a Candidaten
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    // Store accounts that have voted
    mapping(address => bool) public voters;

    // Read/write candidates
    mapping(uint256 => Candidate) public candidates;

    // Store Candidates Count
    uint256 public candidatesCount;

    uint256 public votersCount;
    address[] public votersAddres;

    // Store Accounts Coubt
    uint256 public accountesCount;

    address public owner;

    bool public settingTime = false;
    uint256 public startTime;
    uint256 public finishTime;
    uint256 public durationTime;

    // Create Book Of Voters
    mapping(address => bool) public bookOfVoters;

    event votedEvent(uint256 indexed _candidateId);

    constructor(ElectionToken _tokenContract) public {
        owner = msg.sender;

        tokenContract = _tokenContract;

        addCandidate("Bibi");
        addCandidate("Gantz");
    }

    modifier onlyOwner {
        require(msg.sender == owner, "YOU NOT OWNER");
        _;
    }

    function addCandidate(string memory _name) public onlyOwner {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0);
    }

    function BookOfVotes(address _voterAddres) public onlyOwner {
        bookOfVoters[_voterAddres] = true;
    }

    function settingTimes(
        uint256 _startTime,
        uint256 _finishTime,
        uint256 _durationTime
    ) public onlyOwner {
        settingTime = true;
        startTime = _startTime;
        finishTime = _finishTime;
        durationTime = _durationTime;
    }

    function vote(uint256 _candidateId) public {
        votersCount++;
        votersAddres.push(msg.sender);

        // require that they haven't voted before
        require((!voters[msg.sender]), "ERROR");

        // require a valid candidate
        require((_candidateId > 0 && _candidateId <= candidatesCount), "ERROR");

        // record that voter has voted
        voters[msg.sender] = true;

        // update candidate vote Count
        candidates[_candidateId].voteCount++;

        // trigger voted event
        emit votedEvent(_candidateId);
    }

}
