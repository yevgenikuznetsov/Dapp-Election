App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  hasVoted: false,

  init: function () {
    return App.initWeb3();
  },

  initWeb3: function () {
    if (typeof web3 !== 'undefined') {
      // If a web3 instance is already provided by Meta Mask.
      App.web3Provider = web3.currentProvider;
      ethereum.enable();
      web3 = new Web3(web3.currentProvider);
    } else {

      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
      web3 = new Web3(App.web3Provider);
    }

    return App.initContract();

  },

  initContract: function () {

    $.getJSON("ElectionToken.json", function (ElectionToken) {
      // Instantiate a new truffle contract from the artifact
      App.contracts.ElectionToken = TruffleContract(ElectionToken);
      // Connect provider to interact with contract
      App.contracts.ElectionToken.setProvider(App.web3Provider);

      $.getJSON("Election.json", function (election) {
        // Instantiate a new truffle contract from the artifact
        App.contracts.Election = TruffleContract(election);
        // Connect provider to interact with contract
        App.contracts.Election.setProvider(App.web3Provider);

        App.listenForEvents();

        return App.render();
      });
    });
  },

  // Listen for events emitted from the contract
  listenForEvents: function () {
    App.contracts.Election.deployed().then(function (instance) {

      instance.votedEvent({}, {
        fromBlock: latest,
        // toBlock: 'latest'
      }).watch(function (error, event) {
        console.log("event triggered", event)
        // Reload when a new vote is recorded
        App.render();
      });
    });
  },

  render: function () {
    var electionInstance;
    var loader = $("#loader")
    var content = $("#content");
    var admin = $('#admin');
    var messageVotingIsOver = $('#votingEnded');
    var messageVotingNotStarted = $('#timeHasNotStartedYet');
    var messageTimeIsOver = $('#timeIsUp')
    var candidatesResults = $('#candidatesResults')

    loader.show();
    content.hide();
    admin.hide();
    messageVotingIsOver.hide();
    messageVotingNotStarted.hide();


    // Load account data
    web3.eth.getCoinbase(function (err, account) {
      if (err === null) {
        App.account = account;
        $("#accountAddress").html("Your Account: " + account);
      }
    });

    // Load contract data
    App.contracts.Election.deployed().then(function (instance) {
      electionInstance = instance;
      return electionInstance.candidatesCount();
    }).then(async function (candidatesCount) {

      var candidatesResults = $("#candidatesResults");
      candidatesResults.empty();

      var candidatesSelect = $('#candidatesSelect');
      candidatesSelect.empty();

      var allCandidate = []
      for (var i = 1; i <= candidatesCount; i++) {
        allCandidate.push(electionInstance.candidates(i))
      }

      //Candidates are sorted by number of votes.
      const candidate = await Promise.all(allCandidate)
      candidate.sort((firstCandidate, secondCandidate) => {
        return secondCandidate[2] - firstCandidate[2]
      }).forEach((candidate, count) => {

        var id = candidate[0];
        var name = candidate[1];
        var voteCount = candidate[2];

        // Render candidate Result
        var candidateTemplate = "<tr><th>" + (count + 1) + "</th><td>" + name + "</td><td>" + voteCount + "</td></tr>"
        candidatesResults.append(candidateTemplate);

        // Render candidate ballot option
        var candidateOption = "<option value='" + id + "' >" + name + "</ option>"
        candidatesSelect.append(candidateOption);

      })

      return electionInstance.voters(App.account);
    }).then(function (hasVoted) {
      // Do not allow a user to vote
      if (hasVoted) {
        $('form').hide();
      }
      loader.hide();
      content.show();
      return electionInstance.owner()
    }).then(function (admin_owner) {
      if (admin_owner == App.account) {
        admin.show();
      }

      return [electionInstance.settingTime(), electionInstance.owner(), electionInstance.startTime(), electionInstance.finishTime(), electionInstance.durationTime()]
    }).then(function ([setTime, owner, start, finish, duration]) {

      //Tests for the time window.
      Promise.resolve(setTime).then(function (settingTime) {
        if (settingTime == true) {
          admin.hide()
          messageTimeIsOver.hide()
          Promise.resolve(start).then(function (startTime) {
            var today = new Date();

            if (today.getTime() > startTime) {
              Promise.resolve(finish).then(function (finishTime) {
                if (finishTime > today.getTime()) {

                  //The voting time window is open.
                  content.show()

                  //Enable timer for user voting time.
                  Promise.resolve(duration).then(function (durationTime) {
                    var countDownDate = Number(durationTime) * 60
                    var x = setInterval(function () {

                      minutes = parseInt(countDownDate / 60, 10);
                      seconds = parseInt(countDownDate % 60, 10);

                      minutes = minutes < 10 ? "0" + minutes : minutes;
                      seconds = seconds < 10 ? "0" + seconds : seconds;

                      document.getElementById("demo").innerHTML = "The time you have left to vote " + minutes + "m" + seconds + "s"

                      if (countDownDate-- < 0) {
                        clearInterval(x);
                        document.getElementById("demo").innerHTML = "Time Is Over";
                        document.getElementById("buttonToVote").disabled = true;
                      }
                    }, 1000);
                  })
                } else {
                  //Send currency ERC20 to all users who voted in the election.
                  Promise.resolve(owner).then(function (owner_id) {
                    if (owner_id == App.account) {
                      App.contracts.Election.deployed().then(function (instance) {
                        return instance.votersCount()
                      }).then(async function (count) {
                        for (var i = 0; i < count; i++) {
                          await App.contracts.Election.deployed().then(function (instance) {
                            return instance.votersAddres(i)
                          }).then(async function (voteAddres) {
                            if (owner_id != voteAddres) {
                              await App.contracts.ElectionToken.deployed().then(function (instance) {
                                return instance.transfer(voteAddres, 1, {
                                  from: App.account
                                })
                              })
                            }
                          })
                        }
                      })
                    }
                    //View the results.
                    messageTimeIsOver.show()
                    $('#voteVandidate').hide()
                    $('#countTimer').hide()
                    $($(candidatesResults).children('tr').get(0)).children('td').get(1);
                    var winner = $($(candidatesResults).children('tr').get(0)).children('td').get(0).textContent

                    var para = document.createElement("h2");
                    var node = document.createTextNode(" THE WINNER IS : " + winner);
                    para.appendChild(node);

                    var element = document.getElementById("content");
                    element.appendChild(para);

                  })
                }
              })
            } else {
              //The election window is not open.
              content.hide()
              messageVotingNotStarted.show()
            }
          })
        } else {
          //The election window is not open.
          content.hide()
          messageTimeIsOver.hide()
          Promise.resolve(owner).then(function (owner_id) {
            if (owner_id == App.account) {
              messageVotingNotStarted.hide()
            } else {
              messageVotingNotStarted.show()
            }
          })
        }
      })
    }).catch(function (error) {
      console.warn(error);
    });
  },

  ///////////////////////////////////////////////////////////////////  
  //Voting option.                                                 //
  //All users select one candidate from the list and vote for it.  //
  ///////////////////////////////////////////////////////////////////

  castVote: function () {
    var candidateId = $('#candidatesSelect').val();
    App.contracts.Election.deployed().then(function (instance) {
      return instance.vote(candidateId, {
        from: App.account
      });
    }).then(function (result) {
      // Wait for votes to update
      $("#content").hide();
      $("#loader").show();
    }).catch(function (err) {
      console.error(err);
    });
  },

  /////////////////////////////////////////////////////////////
  //Add a candidate.                                         //
  //Admin puts the name of the new candidate into the list.  //
  /////////////////////////////////////////////////////////////

  addCandidate: function () {
    var newCandidate = $('#addcandidate').val();
    App.contracts.Election.deployed().then((function (instance) {
      return instance.addCandidate(newCandidate, {
        from: App.account
      })
    })).then(() => {
      return App.render();
    }).catch((function (err) {
      console.error(err);
    }))
  },

  ///////////////////////////////////////////////////  
  //Adding people to a voter book.                 //
  //The admin manually enters to the voter’s book. //
  ///////////////////////////////////////////////////

  addToBookVotesInputText: async function () {
    var voterAddres = $('#addressDataFromText').val();
    await App.contracts.Election.deployed().then((function (instance) {
      return instance.BookOfVotes(voterAddres, {
        from: App.account
      })
    })).catch((function (err) {
      console.error(err);
    }))
  },

  ///////////////////////////////////////////////////////////////////////////////////////  
  //Choosing a window of time.                                                         //
  //Admin selects the Election Time window and in particular each user's time window.  //
  ///////////////////////////////////////////////////////////////////////////////////////

  setElectionTimes: function () {

    var startTime = new Date($('#start').val())
    var finishTime = new Date($('#finish').val())
    var durationTime = $('#durationVote').val()

    App.contracts.Election.deployed().then(function (instance) {
      return instance.settingTimes(startTime.getTime(), finishTime.getTime(), durationTime, {
        from: App.account
      }).then(() => {
        return App.render();
      });
    })
  },

  /////////////////////////////////////////////////////////////////////////////
  //Adding people to a voter book.                                           //
  //Get a text file.                                                         //
  //Read from the file and add the addresses listed there to the voter book. //
  /////////////////////////////////////////////////////////////////////////////

  addToBookVotesInputFile: function () {
    var fileInput = document.getElementById('addressDataFromFile');

    fileInput.addEventListener('change', function (e) {
      var file = fileInput.files[0];
      var textType = /text.*/;

      if (file.type.match(textType)) {
        var reader = new FileReader();

        reader.onload = async function (event) {
          var contents = event.target.result;
          console.log(contents);

          var lines = this.result.split('\n');
          for (var line = 0; line < lines.length; line++) {
            console.log(lines[line]);

            await App.contracts.Election.deployed().then((function (instance) {
              return instance.BookOfVotes(lines[line], {
                from: App.account
              })
            }))
          }
          reader.onerror = function (event) {
            console.error("File could not be read! Code " + event.target.error.code);
          };
        };

        reader.readAsText(file);
      } else {
        fileDisplayArea.innerText = "File not supported!"
      }
    });

  }
};

$(function () {
  $(window).load(function () {
    App.init();
  });
});